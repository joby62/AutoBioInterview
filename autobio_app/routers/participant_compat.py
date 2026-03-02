import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..db import DB, now_iso
from ..model_runtime import get_model_config, set_model_config
from ..prompts import ACTIVE_STAGES
from ..services.participant import (
    advance_stage,
    generate_summary,
    get_participant_state,
    give_consent,
    join_or_resume,
    post_message,
    set_done,
    withdraw_session,
)

router = APIRouter(tags=["participant_compat"])

NEXT_CACHE: Dict[str, Dict[str, Any]] = {}


class ConsentReq(BaseModel):
    token: str
    agreed: bool


class MsgReq(BaseModel):
    token: str
    content: str


class SkipReq(BaseModel):
    token: str
    reason: str = ""


class AdvanceReq(BaseModel):
    token: str


class FinalizeReq(BaseModel):
    token: str
    force: bool = False


class ReviseReq(BaseModel):
    token: str
    instruction: str


class ApproveReq(BaseModel):
    token: str


class WithdrawReq(BaseModel):
    token: str
    reason: str = ""


class NewInterviewReq(BaseModel):
    invite_code: Optional[str] = None


class ModelConfigReq(BaseModel):
    model: Optional[str] = None
    orch_model: Optional[str] = None
    write_model: Optional[str] = None


def _extract_invite_from_referer(request: Request) -> Optional[str]:
    ref = request.headers.get("referer", "")
    if not ref:
        return None
    try:
        path = ref.split("//", 1)[-1].split("/", 1)[1]
    except Exception:
        return None
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "participant":
        return parts[1]
    return None


def _latest_invite_code() -> Optional[str]:
    with DB.session() as conn:
        row = conn.execute(
            """
            SELECT l.invite_code
            FROM invite_links l
            JOIN projects p ON p.id = l.project_id
            WHERE l.status='active'
            ORDER BY p.updated_at DESC, l.created_at DESC
            LIMIT 1
            """
        ).fetchone()
    return row["invite_code"] if row else None


def _parse_questions(text: str) -> List[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    out: List[str] = []
    for ln in lines:
        if len(ln) >= 2 and ln[0].isdigit() and ln[1] == ".":
            out.append(ln[2:].strip())
    if out:
        return out[:2]
    return [raw]


def _readiness(progress: Dict[str, Any]) -> Dict[str, Any]:
    stages: Dict[str, Any] = {}
    all_ready = True
    for stage in ACTIVE_STAGES:
        sp = progress.get(stage, {}) if isinstance(progress, dict) else {}
        turns = int(sp.get("turns", 0) or 0)
        chars = int(sp.get("chars", 0) or 0)
        min_turns = int(sp.get("min_turns", 1) or 1)
        min_chars = int(sp.get("min_chars", 20) or 20)

        missing: List[str] = []
        if turns < min_turns:
            missing.append(f"至少 {min_turns} 轮回答（当前 {turns} 轮）")
        if chars < min_chars:
            missing.append(f"至少 {min_chars} 字（当前 {chars} 字）")

        ready = bool(sp.get("ready", False)) or len(missing) == 0
        stages[stage] = {"ready": ready, "missing": missing}
        if not ready:
            all_ready = False

    return {"all_ready": all_ready, "stages": stages}


def _state_to_export(token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    session = payload.get("session", {})
    progress = payload.get("progress", {})
    messages = payload.get("messages", [])
    summary = session.get("summary_text")

    artifacts: List[Dict[str, Any]] = []
    if summary:
        artifacts.append(
            {
                "type": "draft",
                "version": 1,
                "content": summary,
                "meta_json": json.dumps({"source": "summary"}, ensure_ascii=False),
                "created_at": session.get("updated_at", now_iso()),
            }
        )

    if session.get("stage") == "done" and summary:
        artifacts.append(
            {
                "type": "final",
                "version": 1,
                "content": summary,
                "meta_json": json.dumps({"source": "summary"}, ensure_ascii=False),
                "created_at": session.get("updated_at", now_iso()),
            }
        )

    return {
        "interview": {
            "id": session.get("id"),
            "token": token,
            "stage": session.get("stage", "consent_pending"),
            "created_at": session.get("updated_at"),
            "updated_at": session.get("updated_at"),
            "consented_at": session.get("consented_at"),
        },
        "progress": progress,
        "readiness": _readiness(progress),
        "messages": messages,
        "memory": [],
        "artifacts": artifacts,
        "audit_events": [],
    }


def _build_next_from_result(result: Dict[str, Any], stage: str) -> Dict[str, Any]:
    questions = result.get("questions") if isinstance(result.get("questions"), list) else []
    questions = [str(q).strip() for q in questions if str(q).strip()][:2]
    return {
        "stage": stage,
        "questions": questions,
        "followup_intent": "compat",
        "should_advance_stage": False,
        "suggested_next_stage": stage,
        "risk_flags": ["NONE"],
        "rights_notice": "你可以跳过任何问题，或随时退出访谈。",
        "stage_ready": bool(result.get("stage_ready", False)),
        "missing_requirements": result.get("missing_requirements", []) if isinstance(result.get("missing_requirements"), list) else [],
    }


@router.get("/model-config")
def model_config_get():
    return get_model_config()


@router.post("/model-config")
def model_config_set(req: ModelConfigReq):
    try:
        return set_model_config(model=req.model, orch_model=req.orch_model, write_model=req.write_model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc), "available_models": get_model_config()["available_models"]})


@router.post("/interviews")
def interviews_create(request: Request, req: Optional[NewInterviewReq] = None):
    invite_code = None
    if req:
        invite_code = (req.invite_code or "").strip() or None
    if not invite_code and request is not None:
        invite_code = _extract_invite_from_referer(request)
    if not invite_code:
        invite_code = _latest_invite_code()
    if not invite_code:
        raise HTTPException(status_code=404, detail="暂无可用邀请链接，请先创建项目")

    payload, token = join_or_resume(invite_code, None)
    session = payload.get("session", {})
    return {
        "interview_id": session.get("id", ""),
        "token": token,
        "stage": session.get("stage", "consent_pending"),
        "consent_required": session.get("stage", "consent_pending") == "consent_pending",
    }


@router.post("/consent")
def consent(req: ConsentReq):
    payload = give_consent(req.token, req.agreed)
    return {"ok": True, "stage": payload.get("session", {}).get("stage", "consent_pending")}


@router.post("/withdraw")
def withdraw(req: WithdrawReq):
    payload = withdraw_session(req.token, req.reason)
    return {"ok": True, "stage": payload.get("session", {}).get("stage", "withdrawn")}


@router.post("/messages")
def messages(req: MsgReq):
    result = post_message(req.token, req.content)
    NEXT_CACHE[req.token] = result
    return {"ok": True, "risk_flags": ["NONE"]}


@router.post("/next")
def next_question(token: str):
    state_payload = get_participant_state(token)
    stage = state_payload.get("session", {}).get("stage", "daily")

    cached = NEXT_CACHE.pop(token, None)
    if cached:
        return _build_next_from_result(cached, stage)

    messages = state_payload.get("messages", [])
    assistant = None
    for m in reversed(messages):
        if m.get("role") == "assistant":
            assistant = m
            break

    questions = _parse_questions((assistant or {}).get("content", ""))
    readiness = _readiness(state_payload.get("progress", {}))
    stage_info = readiness.get("stages", {}).get(stage, {"ready": False, "missing": []})

    return {
        "stage": stage,
        "questions": questions[:2] if questions else ["我们继续。你愿意再补充一个具体细节吗？"],
        "followup_intent": "compat_fallback",
        "should_advance_stage": False,
        "suggested_next_stage": stage,
        "risk_flags": ["NONE"],
        "rights_notice": "你可以跳过任何问题，或随时退出访谈。",
        "stage_ready": bool(stage_info.get("ready", False)),
        "missing_requirements": stage_info.get("missing", []),
    }


@router.post("/skip")
def skip(req: SkipReq):
    msg = "【受访者选择跳过此问题】"
    if req.reason:
        msg += f" 原因：{req.reason}"
    result = post_message(req.token, msg)
    state_payload = get_participant_state(req.token)
    stage = state_payload.get("session", {}).get("stage", "daily")
    return _build_next_from_result(result, stage)


@router.post("/advance-stage")
def advance_stage_compat(req: AdvanceReq):
    payload = advance_stage(req.token)
    session = payload.get("session", {})
    stage = session.get("stage", "daily")

    messages = payload.get("messages", [])
    assistant = None
    for m in reversed(messages):
        if m.get("role") == "assistant":
            assistant = m
            break
    questions = _parse_questions((assistant or {}).get("content", ""))
    return {"ok": True, "stage": stage, "questions": questions[:2]}


@router.post("/finalize")
def finalize(req: FinalizeReq):
    payload = generate_summary(req.token)
    session = payload.get("session", {})
    content = session.get("summary_text") or ""
    return {
        "interview_id": session.get("id", ""),
        "version": 1,
        "content": content,
        "stage": "review",
    }


@router.post("/revise-final")
def revise(req: ReviseReq):
    # Current v3 backend uses unified summary generation; for compatibility we regenerate once.
    payload = generate_summary(req.token)
    session = payload.get("session", {})
    content = session.get("summary_text") or ""
    if req.instruction.strip():
        content = f"{content}\n\n【修改指令】{req.instruction.strip()}"
    return {
        "interview_id": session.get("id", ""),
        "version": 1,
        "content": content,
        "stage": "review",
    }


@router.post("/approve-final")
def approve(req: ApproveReq):
    payload = set_done(req.token)
    return {
        "ok": True,
        "stage": payload.get("session", {}).get("stage", "done"),
        "final_version": 1,
    }


@router.get("/export")
def export(token: str):
    payload = get_participant_state(token)
    return _state_to_export(token, payload)

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from ..db import DB, now_iso
from ..llm import LLM
from ..model_runtime import get_active_models
from ..prompts import (
    ACTIVE_STAGES,
    DEFAULT_TEMPLATE,
    QUESTION_SCHEMA,
    QUESTION_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    stage_map,
)
from ..security import new_token


def _parse_json(raw: str, fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    try:
        obj = json.loads(raw or "{}")
        if isinstance(obj, dict):
            return obj
        return fallback or {}
    except Exception:
        return fallback or {}


def _safe_stage(stage: str) -> str:
    if stage in ACTIVE_STAGES:
        return stage
    return ACTIVE_STAGES[0]


def _blank_progress(template: Dict[str, Any]) -> Dict[str, Any]:
    smap = stage_map(template)
    out: Dict[str, Any] = {}
    for key in ACTIVE_STAGES:
        conf = smap.get(key, {})
        out[key] = {
            "turns": 0,
            "chars": 0,
            "ready": False,
            "min_turns": int(conf.get("min_turns", 1)),
            "min_chars": int(conf.get("min_chars", 20)),
            "samples": [],
        }
    return out


def _is_stage_ready(progress_stage: Dict[str, Any], stage_conf: Dict[str, Any]) -> Tuple[bool, List[str]]:
    missing: List[str] = []
    min_turns = int(stage_conf.get("min_turns", 1))
    min_chars = int(stage_conf.get("min_chars", 20))

    turns = int(progress_stage.get("turns", 0) or 0)
    chars = int(progress_stage.get("chars", 0) or 0)

    if turns < min_turns:
        missing.append(f"至少 {min_turns} 轮回答（当前 {turns} 轮）")
    if chars < min_chars:
        missing.append(f"至少 {min_chars} 字（当前 {chars} 字）")

    return len(missing) == 0, missing


def _next_stage(stage: str) -> str:
    if stage not in ACTIVE_STAGES:
        return ACTIVE_STAGES[0]
    idx = ACTIVE_STAGES.index(stage)
    if idx >= len(ACTIVE_STAGES) - 1:
        return "review"
    return ACTIVE_STAGES[idx + 1]


def _append_message(session_id: str, role: str, content: str, meta: Optional[Dict[str, Any]] = None) -> None:
    with DB.session() as conn:
        conn.execute(
            """
            INSERT INTO messages (id, session_id, role, content, meta_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (DB.uuid(), session_id, role, content, json.dumps(meta or {}, ensure_ascii=False), now_iso()),
        )
        conn.execute("UPDATE interview_sessions SET updated_at=? WHERE id=?", (now_iso(), session_id))


def _fetch_project_and_template_by_invite(invite_code: str) -> Dict[str, Any]:
    with DB.session() as conn:
        row = conn.execute(
            """
            SELECT l.id AS invite_id, l.invite_code, l.status,
                   p.id AS project_id, p.title, p.invitation_text, p.template_json
            FROM invite_links l
            JOIN projects p ON p.id = l.project_id
            WHERE l.invite_code=?
            """,
            (invite_code,),
        ).fetchone()
    if not row or row["status"] != "active":
        raise HTTPException(status_code=404, detail="邀请链接无效或已失效")
    data = dict(row)
    data["template"] = _parse_json(data.get("template_json", "{}"), DEFAULT_TEMPLATE)
    return data


def _load_session_by_token(participant_token: str) -> Optional[Dict[str, Any]]:
    if not participant_token:
        return None
    with DB.session() as conn:
        row = conn.execute(
            """
            SELECT s.*, p.title AS project_title, p.template_json, l.invite_code
            FROM interview_sessions s
            JOIN projects p ON p.id = s.project_id
            JOIN invite_links l ON l.id = s.invite_id
            WHERE s.participant_token=?
            """,
            (participant_token,),
        ).fetchone()
    if not row:
        return None
    out = dict(row)
    out["template"] = _parse_json(out.get("template_json", "{}"), DEFAULT_TEMPLATE)
    out["progress"] = _parse_json(out.get("progress_json", "{}"), _blank_progress(out["template"]))
    return out


def _serialize_session_payload(session: Dict[str, Any]) -> Dict[str, Any]:
    with DB.session() as conn:
        rows = conn.execute(
            "SELECT role, content, meta_json, created_at FROM messages WHERE session_id=? ORDER BY created_at ASC",
            (session["id"],),
        ).fetchall()
    return {
        "session": {
            "id": session["id"],
            "participant_token": session["participant_token"],
            "project_title": session["project_title"],
            "invite_code": session["invite_code"],
            "stage": session["stage"],
            "consented_at": session.get("consented_at"),
            "summary_text": session.get("summary_text"),
            "updated_at": session.get("updated_at"),
        },
        "template": session["template"],
        "progress": session["progress"],
        "messages": [dict(r) for r in rows],
    }


def join_or_resume(invite_code: str, existing_token: Optional[str]) -> Tuple[Dict[str, Any], str]:
    invite = _fetch_project_and_template_by_invite(invite_code)
    template = invite["template"]

    if existing_token:
        existing = _load_session_by_token(existing_token)
        if existing and existing["invite_code"] == invite_code:
            return _serialize_session_payload(existing), existing_token

    session_id = DB.uuid()
    participant_token = new_token(18)
    progress = _blank_progress(template)
    created_at = now_iso()

    with DB.session() as conn:
        conn.execute(
            """
            INSERT INTO interview_sessions (
              id, project_id, invite_id, participant_token, stage, progress_json,
              consented_at, withdrawn_at, summary_text, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'consent_pending', ?, NULL, NULL, NULL, ?, ?)
            """,
            (session_id, invite["project_id"], invite["invite_id"], participant_token, json.dumps(progress, ensure_ascii=False), created_at, created_at),
        )

    opening = template.get("opening_script") or DEFAULT_TEMPLATE["opening_script"]
    _append_message(
        session_id,
        "assistant",
        f"{opening}\n\n如果你同意参与，请点击“我同意并开始”。",
        {"type": "invitation"},
    )

    DB.add_audit(
        project_id=invite["project_id"],
        session_id=session_id,
        actor_type="participant",
        actor_id=participant_token,
        event_type="participant_joined",
        payload={"invite_code": invite_code},
    )

    session = _load_session_by_token(participant_token)
    assert session is not None
    return _serialize_session_payload(session), participant_token


def get_participant_state(participant_token: str) -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效，请重新通过邀请链接进入")
    return _serialize_session_payload(session)


def give_consent(participant_token: str, agreed: bool) -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")
    if session["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="会话已终止")

    now = now_iso()

    if not agreed:
        with DB.session() as conn:
            conn.execute(
                "UPDATE interview_sessions SET stage='withdrawn', withdrawn_at=?, updated_at=? WHERE id=?",
                (now, now, session["id"]),
            )
        _append_message(session["id"], "assistant", "已记录为不同意参与，本次访谈结束。", {"type": "consent_reject"})
        DB.add_audit(
            project_id=session["project_id"],
            session_id=session["id"],
            actor_type="participant",
            actor_id=participant_token,
            event_type="consent_rejected",
            payload={},
        )
        return get_participant_state(participant_token)

    if session["stage"] == "consent_pending":
        first_stage = ACTIVE_STAGES[0]
        with DB.session() as conn:
            conn.execute(
                "UPDATE interview_sessions SET stage=?, consented_at=?, updated_at=? WHERE id=?",
                (first_stage, now, now, session["id"]),
            )

        smap = stage_map(session["template"])
        hints = smap[first_stage]["prompt_hints"]
        q1 = hints[0] if hints else "回忆最近一次数字学习场景。"
        q2 = hints[1] if len(hints) > 1 else "说说具体时间、平台和你在做什么。"
        _append_message(
            session["id"],
            "assistant",
            f"感谢同意参与，我们先从{smap[first_stage]['title']}开始。\n1. {q1}\n2. {q2}",
            {"type": "consent_ack", "stage": first_stage},
        )
        DB.add_audit(
            project_id=session["project_id"],
            session_id=session["id"],
            actor_type="participant",
            actor_id=participant_token,
            event_type="consent_granted",
            payload={},
        )

    return get_participant_state(participant_token)


def _recent_dialogue(session_id: str, limit: int = 8) -> List[Dict[str, str]]:
    with DB.session() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    out = [dict(r) for r in rows]
    out.reverse()
    return out


def _update_progress(progress: Dict[str, Any], stage: str, user_text: str, stage_conf: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, List[str]]:
    progress_stage = progress.get(stage, {})
    progress_stage["turns"] = int(progress_stage.get("turns", 0) or 0) + 1
    progress_stage["chars"] = int(progress_stage.get("chars", 0) or 0) + len(user_text)
    samples = progress_stage.get("samples") if isinstance(progress_stage.get("samples"), list) else []
    samples.append(user_text[:220])
    progress_stage["samples"] = samples[-5:]
    ready, missing = _is_stage_ready(progress_stage, stage_conf)
    progress_stage["ready"] = ready
    progress[stage] = progress_stage
    return progress, ready, missing


def _next_questions(session: Dict[str, Any], stage: str, progress_stage: Dict[str, Any], stage_conf: Dict[str, Any]) -> Dict[str, Any]:
    dialogue = _recent_dialogue(session["id"], limit=10)
    payload = {
        "stage": stage,
        "stage_title": stage_conf.get("title", stage),
        "stage_goal": stage_conf.get("goal", ""),
        "stage_hints": stage_conf.get("prompt_hints", []),
        "stage_progress": {
            "turns": progress_stage.get("turns", 0),
            "chars": progress_stage.get("chars", 0),
            "samples": progress_stage.get("samples", []),
        },
        "recent_dialogue": dialogue,
    }

    orch_model, _ = get_active_models()
    try:
        out = LLM.json(
            system_prompt=QUESTION_SYSTEM_PROMPT,
            user_text=json.dumps(payload, ensure_ascii=False),
            schema=QUESTION_SCHEMA,
            model=orch_model,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "LLM 提问失败（未自动重试）",
                "stage": stage,
                "model": orch_model,
                "error": str(exc),
            },
        )

    questions = out.get("questions", []) if isinstance(out.get("questions"), list) else []
    questions = [str(q).strip() for q in questions if str(q).strip()][:2]
    if not questions:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "LLM 返回空问题（未自动重试）",
                "stage": stage,
                "model": orch_model,
                "raw": out,
            },
        )
    if any(len(q) < 14 for q in questions):
        raise HTTPException(
            status_code=502,
            detail={
                "message": "LLM 返回问题过短（未自动重试）",
                "stage": stage,
                "model": orch_model,
                "questions": questions,
            },
        )
    return {
        "questions": questions,
        "stage_ready_hint": bool(out.get("stage_ready", False)),
        "reason": str(out.get("reason", "")).strip(),
    }


def post_message(participant_token: str, content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="请输入内容")

    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")

    stage = session["stage"]
    if stage == "consent_pending":
        raise HTTPException(status_code=409, detail="请先同意参与")
    if stage == "withdrawn":
        raise HTTPException(status_code=409, detail="会话已终止")

    if stage not in ACTIVE_STAGES:
        raise HTTPException(status_code=409, detail="当前阶段不可继续提问")

    _append_message(session["id"], "user", text, {"stage": stage})

    template = session["template"]
    smap = stage_map(template)
    stage_conf = smap.get(stage, {})

    progress = session["progress"]
    progress, ready, missing = _update_progress(progress, stage, text, stage_conf)

    next_pack = _next_questions(session, stage, progress.get(stage, {}), stage_conf)
    questions = next_pack["questions"][:2]
    assistant_text = "\n".join([f"{i + 1}. {q}" for i, q in enumerate(questions)])
    _append_message(
        session["id"],
        "assistant",
        assistant_text,
        {
            "stage": stage,
            "stage_ready": ready,
            "missing": missing,
            "stage_ready_hint": bool(next_pack.get("stage_ready_hint", False)),
            "reason": next_pack.get("reason", ""),
        },
    )

    with DB.session() as conn:
        conn.execute(
            "UPDATE interview_sessions SET progress_json=?, updated_at=? WHERE id=?",
            (json.dumps(progress, ensure_ascii=False), now_iso(), session["id"]),
        )

    return {
        "stage": stage,
        "questions": questions,
        "stage_ready": ready,
        "missing_requirements": missing,
        "can_advance": ready,
    }


def advance_stage(participant_token: str) -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")

    stage = session["stage"]
    if stage not in ACTIVE_STAGES:
        raise HTTPException(status_code=409, detail="当前阶段不可推进")

    smap = stage_map(session["template"])
    progress_stage = session["progress"].get(stage, {})
    ready, missing = _is_stage_ready(progress_stage, smap.get(stage, {}))
    if not ready:
        raise HTTPException(status_code=400, detail={"message": "当前阶段信息不足", "missing": missing})

    next_stage = _next_stage(stage)
    with DB.session() as conn:
        conn.execute("UPDATE interview_sessions SET stage=?, updated_at=? WHERE id=?", (next_stage, now_iso(), session["id"]))

    if next_stage in ACTIVE_STAGES:
        hints = smap.get(next_stage, {}).get("prompt_hints", [])
        title = smap.get(next_stage, {}).get("title", next_stage)
        q1 = hints[0] if hints else "我们进入下一阶段，你愿意继续说说吗？"
        q2 = hints[1] if len(hints) > 1 else "请再补充一个具体片段。"
        _append_message(session["id"], "assistant", f"已进入 {title}。\n1. {q1}\n2. {q2}", {"type": "stage_advance", "stage": next_stage})
    else:
        _append_message(session["id"], "assistant", "阶段访谈已完成。你可以点击“生成总结”。", {"type": "stage_advance", "stage": next_stage})

    return get_participant_state(participant_token)


def generate_summary(participant_token: str) -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")
    if session["stage"] == "consent_pending":
        raise HTTPException(status_code=409, detail="请先同意参与")
    if session["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="会话已终止")

    with DB.session() as conn:
        rows = conn.execute(
            "SELECT role, content, created_at FROM messages WHERE session_id=? ORDER BY created_at ASC",
            (session["id"],),
        ).fetchall()

    transcript = [dict(r) for r in rows if r["role"] in {"user", "assistant"}]
    if not transcript:
        raise HTTPException(status_code=400, detail="暂无可总结内容")

    user_payload = json.dumps(
        {
            "project_title": session["project_title"],
            "template": session["template"],
            "transcript": transcript,
        },
        ensure_ascii=False,
    )

    _, write_model = get_active_models()
    try:
        summary = LLM.text(
            system_prompt=SUMMARY_SYSTEM_PROMPT,
            user_text=user_payload,
            model=write_model,
        ).strip()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "LLM 总结失败（未自动重试）",
                "model": write_model,
                "error": str(exc),
            },
        )

    with DB.session() as conn:
        conn.execute(
            "UPDATE interview_sessions SET summary_text=?, stage='review', updated_at=? WHERE id=?",
            (summary, now_iso(), session["id"]),
        )

    _append_message(session["id"], "assistant", "已生成本次访谈总结，可继续补充或结束。", {"type": "summary_ready"})

    return get_participant_state(participant_token)


def set_done(participant_token: str) -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")
    if session["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="会话已终止")

    with DB.session() as conn:
        conn.execute(
            "UPDATE interview_sessions SET stage='done', updated_at=? WHERE id=?",
            (now_iso(), session["id"]),
        )

    _append_message(session["id"], "assistant", "已确认定稿，访谈完成。", {"type": "done"})
    return get_participant_state(participant_token)


def withdraw_session(participant_token: str, reason: str = "") -> Dict[str, Any]:
    session = _load_session_by_token(participant_token)
    if not session:
        raise HTTPException(status_code=401, detail="会话已失效")
    if session["stage"] == "withdrawn":
        return get_participant_state(participant_token)

    with DB.session() as conn:
        conn.execute(
            "UPDATE interview_sessions SET stage='withdrawn', withdrawn_at=?, updated_at=? WHERE id=?",
            (now_iso(), now_iso(), session["id"]),
        )

    _append_message(
        session["id"],
        "assistant",
        "已为你终止访谈。若后续想恢复，请联系研究者。",
        {"type": "withdrawn", "reason": reason},
    )
    return get_participant_state(participant_token)

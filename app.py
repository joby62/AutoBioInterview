import json
import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

ARK_BASE_URL = os.environ.get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
ARK_API_KEY = os.environ.get("ARK_API_KEY") or os.environ.get("OPENAI_API_KEY")
if not ARK_API_KEY:
    raise RuntimeError("Missing ARK_API_KEY (or OPENAI_API_KEY fallback) in environment")

client = OpenAI(base_url=ARK_BASE_URL, api_key=ARK_API_KEY)

DB_PATH = os.environ.get("DB_PATH", "./interviews.db")
MODEL_ORCH = os.environ.get("MODEL_ORCH", "doubao-seed-2-0-lite-260215")
MODEL_WRITE = os.environ.get("MODEL_WRITE", "doubao-seed-2-0-lite-260215")

ACTIVE_STAGES = ["daily", "evolution", "experience", "difficulty", "impact", "wrapup"]
ALL_STAGES = ["consent_pending", *ACTIVE_STAGES, "review", "done", "withdrawn"]

COVERAGE_FIELDS = [
    "events",
    "routines",
    "turning_points",
    "feelings",
    "difficulties",
    "strategies",
    "impacts",
    "tensions",
    "supplements",
]

STAGE_REQUIREMENTS: Dict[str, List[Tuple[str, int, str]]] = {
    "daily": [
        ("events", 2, "至少 2 个具体日常学习场景"),
        ("routines", 1, "至少 1 条稳定学习节奏"),
    ],
    "evolution": [
        ("events", 2, "至少 2 个阶段变化事件"),
        ("turning_points", 1, "至少 1 个关键节点"),
    ],
    "experience": [
        ("feelings", 2, "至少 2 种情绪或体验"),
        ("events", 1, "至少 1 段难忘经历"),
    ],
    "difficulty": [
        ("difficulties", 2, "至少 2 类困难"),
        ("strategies", 1, "至少 1 种应对策略"),
    ],
    "impact": [
        ("impacts", 2, "至少 2 个影响面"),
        ("tensions", 1, "至少 1 个珍视点或矛盾点"),
    ],
    "wrapup": [
        ("supplements", 1, "至少 1 条补充，或明确“暂无补充”"),
    ],
}

INVITATION_NOTICE = (
    "欢迎参与“数字学习自传”研究。你将通过聊天回顾自己的数字学习经历。"
    "你有权跳过任何问题、随时暂停、撤回访谈；也可以补充修改。"
    "内容仅用于学术研究，发布时会进行匿名化处理。"
)

# -----------------------------
# Time and DB
# -----------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    cols = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def init_db() -> None:
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS interviews (
          id TEXT PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          stage TEXT NOT NULL,
          progress_json TEXT NOT NULL,
          consent_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          withdrawn_at TEXT,
          consented_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          interview_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          meta_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(interview_id) REFERENCES interviews(id)
        );

        CREATE TABLE IF NOT EXISTS memory_facts (
          interview_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY(interview_id, key),
          FOREIGN KEY(interview_id) REFERENCES interviews(id)
        );

        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          interview_id TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          version INTEGER NOT NULL,
          meta_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(interview_id) REFERENCES interviews(id)
        );

        CREATE TABLE IF NOT EXISTS alternative_submissions (
          id TEXT PRIMARY KEY,
          interview_id TEXT NOT NULL,
          submission_type TEXT NOT NULL,
          url TEXT,
          transcript TEXT,
          note TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(interview_id) REFERENCES interviews(id)
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          interview_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(interview_id) REFERENCES interviews(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_interview_time
          ON messages(interview_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_interview_time
          ON audit_events(interview_id, created_at);
        """
    )

    # Backward-compatible migrations for old MVP dbs.
    ensure_column(conn, "interviews", "consent_json", "TEXT")
    ensure_column(conn, "interviews", "withdrawn_at", "TEXT")
    ensure_column(conn, "interviews", "consented_at", "TEXT")
    ensure_column(conn, "interviews", "last_error", "TEXT")
    ensure_column(conn, "messages", "meta_json", "TEXT")
    ensure_column(conn, "artifacts", "meta_json", "TEXT")

    conn.commit()
    conn.close()


# -----------------------------
# Redaction and helpers
# -----------------------------
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s-]{7,}\d)(?!\d)")
CHINA_ID_RE = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")
URL_RE = re.compile(r"https?://[^\s]+")
WECHAT_RE = re.compile(r"(?:微信|wechat|wx)[:：\s]*[A-Za-z][A-Za-z0-9_-]{5,}", re.IGNORECASE)
QQ_RE = re.compile(r"(?:QQ|qq)[:：\s]*\d{5,12}")
NAME_CTX_RE = re.compile(r"(我叫|我是|姓名[:：]\s*)([\u4e00-\u9fa5·]{2,8})")
ORG_RE = re.compile(r"[\u4e00-\u9fa5A-Za-z0-9]{2,30}(?:大学|学院|公司|集团|研究院|实验室|工作室)")
ADDRESS_RE = re.compile(r"[\u4e00-\u9fa5A-Za-z0-9]{2,30}(?:省|市|区|县|路|街|道|号)")


def unique_strs(items: List[Any], limit: int = 30) -> List[str]:
    out: List[str] = []
    seen = set()
    for it in items:
        s = str(it).strip()
        if not s:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
        if len(out) >= limit:
            break
    return out


def redact_text(text: str) -> Tuple[str, List[str]]:
    flags: List[str] = []
    out = text

    def mark(flag: str) -> None:
        if flag not in flags:
            flags.append(flag)

    if EMAIL_RE.search(out) or PHONE_RE.search(out) or CHINA_ID_RE.search(out) or WECHAT_RE.search(out) or QQ_RE.search(out):
        mark("CONTACT")
    if NAME_CTX_RE.search(out):
        mark("IDENTITY")
    if ADDRESS_RE.search(out):
        mark("LOCATION")
    if ORG_RE.search(out):
        mark("EMPLOYER")

    out = EMAIL_RE.sub("[EMAIL]", out)
    out = PHONE_RE.sub("[PHONE]", out)
    out = CHINA_ID_RE.sub("[ID]", out)
    out = URL_RE.sub("[URL]", out)
    out = WECHAT_RE.sub("微信: [CONTACT]", out)
    out = QQ_RE.sub("QQ: [CONTACT]", out)
    out = NAME_CTX_RE.sub(r"\1[NAME]", out)
    out = ORG_RE.sub("[ORG]", out)
    out = ADDRESS_RE.sub("[LOCATION]", out)

    return out, flags


def blank_stage_progress() -> Dict[str, Any]:
    return {
        field: [] for field in COVERAGE_FIELDS
    } | {
        "turns": 0,
        "ready": False,
    }


def blank_progress() -> Dict[str, Any]:
    return {stage: blank_stage_progress() for stage in ACTIVE_STAGES}


def normalize_progress(raw: Any) -> Dict[str, Any]:
    base = blank_progress()

    if isinstance(raw, dict):
        for stage in ACTIVE_STAGES:
            incoming = raw.get(stage)
            if isinstance(incoming, dict):
                for field in COVERAGE_FIELDS:
                    vals = incoming.get(field, [])
                    if isinstance(vals, list):
                        base[stage][field] = unique_strs(vals)
                turns = incoming.get("turns", 0)
                base[stage]["turns"] = int(turns) if isinstance(turns, (int, float)) else 0
            elif isinstance(incoming, (int, float)):
                # Legacy format: stage score only.
                base[stage]["turns"] = int(incoming)

    for stage in ACTIVE_STAGES:
        ready, _ = evaluate_stage_ready(stage, base[stage])
        base[stage]["ready"] = ready

    return base


def evaluate_stage_ready(stage: str, stage_progress: Dict[str, Any]) -> Tuple[bool, List[str]]:
    reqs = STAGE_REQUIREMENTS.get(stage, [])
    missing: List[str] = []
    for field, min_count, label in reqs:
        actual = len(unique_strs(stage_progress.get(field, [])))
        if actual < min_count:
            missing.append(label)
    return len(missing) == 0, missing


def evaluate_overall_readiness(progress: Dict[str, Any]) -> Dict[str, Any]:
    per_stage: Dict[str, Any] = {}
    all_ready = True
    for stage in ACTIVE_STAGES:
        ready, missing = evaluate_stage_ready(stage, progress.get(stage, {}))
        per_stage[stage] = {
            "ready": ready,
            "missing": missing,
        }
        if not ready:
            all_ready = False
    return {"all_ready": all_ready, "stages": per_stage}


def next_stage(current: str) -> str:
    if current not in ACTIVE_STAGES:
        return "wrapup"
    idx = ACTIVE_STAGES.index(current)
    if idx >= len(ACTIVE_STAGES) - 1:
        return "wrapup"
    return ACTIVE_STAGES[idx + 1]


def is_active_interview_stage(stage: str) -> bool:
    return stage in ACTIVE_STAGES


# -----------------------------
# Prompt and schema
# -----------------------------
ORCH_SYSTEM = """你是一名“数字学习自传”研究访谈代理，严格围绕邀请函诉求进行访谈。

研究目标：帮助受访者写出第一人称、具体细腻、真实可反思的数字学习自传。
访谈原则：
1) 每轮只问 1-2 个问题。
2) 追问具体事件（平台/内容/时间/场景/感受），避免抽象总结。
3) 尊重参与者权利：允许拒答/跳过；不逼问。
4) 若出现可识别信息（姓名、单位、地点、联系方式），提示可改成“某公司/某城市”等。
5) 问题要自然口语化，不要学术腔。

阶段定义：
- daily：日常数字学习内容、时间节奏、平台工具。
- evolution：不同阶段演变（求学/求职/工作等）和关键节点。
- experience：情绪体验与难忘经历。
- difficulty：困难、应对策略、有效/无效。
- impact：对学业/职业/关系/生活方式/自我认同的影响。
- wrapup：补漏、确认匿名化、是否还有补充。

你必须输出符合 JSON Schema 的结果，不要输出其他文本。"""

WRITE_SYSTEM = """你是一名写作者，请把访谈材料写成受访者第一人称“数字学习自传”。
要求：
- 语言自然、具体、细腻，避免学术腔。
- 保留矛盾和反思，不要写成简历。
- 覆盖：日常节奏、阶段演变、体验、困难应对、影响与反思。
- 遇到可识别信息要匿名化（某公司/某城市/某高校）。
- 可自然分段，不必机械套模板。
- 信息充分时尽量长（建议 >= 3500 字）。"""

ORCH_SCHEMA: Dict[str, Any] = {
    "name": "interview_orchestrator_output",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "next_questions": {
                "type": "array",
                "minItems": 1,
                "maxItems": 2,
                "items": {"type": "string"},
            },
            "followup_intent": {"type": "string"},
            "should_advance_stage": {"type": "boolean"},
            "suggested_next_stage": {"type": "string", "enum": ACTIVE_STAGES + ["done"]},
            "memory_updates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "key": {"type": "string"},
                        "value": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    },
                    "required": ["key", "value", "confidence"],
                },
            },
            "coverage_updates": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "events": {"type": "array", "items": {"type": "string"}},
                    "routines": {"type": "array", "items": {"type": "string"}},
                    "turning_points": {"type": "array", "items": {"type": "string"}},
                    "feelings": {"type": "array", "items": {"type": "string"}},
                    "difficulties": {"type": "array", "items": {"type": "string"}},
                    "strategies": {"type": "array", "items": {"type": "string"}},
                    "impacts": {"type": "array", "items": {"type": "string"}},
                    "tensions": {"type": "array", "items": {"type": "string"}},
                    "supplements": {"type": "array", "items": {"type": "string"}},
                },
                "required": COVERAGE_FIELDS,
            },
            "risk_flags": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["IDENTITY", "LOCATION", "EMPLOYER", "CONTACT", "MINOR", "NONE"],
                },
            },
            "rights_reminder": {"type": "string"},
        },
        "required": [
            "next_questions",
            "followup_intent",
            "should_advance_stage",
            "suggested_next_stage",
            "memory_updates",
            "coverage_updates",
            "risk_flags",
            "rights_reminder",
        ],
    },
    "strict": True,
}


def _obj_get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _extract_text_from_response(resp: Any) -> str:
    # Responses API happy-path
    output_text = _obj_get(resp, "output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    # Chat Completions fallback
    choices = _obj_get(resp, "choices", [])
    if choices:
        msg = _obj_get(choices[0], "message", {})
        content = _obj_get(msg, "content")
        if isinstance(content, str) and content.strip():
            return content.strip()

    # Generic fallback for provider variants
    output = _obj_get(resp, "output", []) or []
    chunks: List[str] = []
    for item in output:
        for part in _obj_get(item, "content", []) or []:
            text = _obj_get(part, "text")
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
    if chunks:
        return "\n".join(chunks).strip()

    return ""


def _parse_json_text(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        data = json.loads(raw[start : end + 1])

    if not isinstance(data, dict):
        raise RuntimeError("Expected JSON object from model output")
    return data


def _llm_text(
    model: str,
    system_prompt: str,
    user_text: str,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str:
    # Primary: use Responses API (matches Ark / Doubao OpenAI-compatible examples).
    try:
        request: Dict[str, Any] = {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_text}],
                },
            ],
        }
        if json_schema:
            request["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": json_schema["name"],
                    "schema": json_schema["schema"],
                    "strict": bool(json_schema.get("strict", True)),
                }
            }

        resp = client.responses.create(**request)
        text = _extract_text_from_response(resp)
        if text:
            return text
    except Exception:
        # Fallback for providers that only support chat.completions.
        pass

    request = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
    }
    if json_schema:
        request["response_format"] = {"type": "json_schema", "json_schema": json_schema}

    resp = client.chat.completions.create(**request)
    text = _extract_text_from_response(resp)
    if not text:
        raise RuntimeError("Empty model output")
    return text


def orchestrate_next(stage: str, recent_msgs: List[Dict[str, str]], memory: Dict[str, Any], progress: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "stage": stage,
        "memory": memory,
        "progress": progress.get(stage, {}),
        "stage_requirements": STAGE_REQUIREMENTS.get(stage, []),
        "recent_messages": recent_msgs,
    }
    text = _llm_text(
        model=MODEL_ORCH,
        system_prompt=ORCH_SYSTEM,
        user_text=json.dumps(payload, ensure_ascii=False),
        json_schema=ORCH_SCHEMA,
    )
    return _parse_json_text(text)


def synthesize_autobiography(memory: Dict[str, Any], progress: Dict[str, Any], excerpts: List[str], revision_note: str = "") -> str:
    payload = {
        "memory": memory,
        "progress": progress,
        "excerpts": excerpts,
        "revision_note": revision_note,
    }

    text = _llm_text(
        model=MODEL_WRITE,
        system_prompt=WRITE_SYSTEM,
        user_text=json.dumps(payload, ensure_ascii=False),
    )
    return text.strip()


# -----------------------------
# Models
# -----------------------------
class CreateInterviewResp(BaseModel):
    interview_id: str
    token: str
    stage: str
    consent_required: bool


class ConsentReq(BaseModel):
    token: str
    agreed: bool


class PostMessageReq(BaseModel):
    token: str
    content: str


class SkipReq(BaseModel):
    token: str
    reason: Optional[str] = ""


class WithdrawReq(BaseModel):
    token: str
    reason: Optional[str] = ""


class AlternativeSubmissionReq(BaseModel):
    token: str
    submission_type: str
    url: Optional[str] = ""
    transcript: Optional[str] = ""
    note: Optional[str] = ""


class NextQuestionResp(BaseModel):
    stage: str
    questions: List[str]
    followup_intent: str
    should_advance_stage: bool
    suggested_next_stage: str
    risk_flags: List[str]
    rights_notice: str
    stage_ready: bool
    missing_requirements: List[str]


class FinalizeReq(BaseModel):
    token: str
    force: bool = False


class FinalizeResp(BaseModel):
    interview_id: str
    version: int
    content: str
    stage: str


class ReviseFinalReq(BaseModel):
    token: str
    instruction: str


class ApproveFinalReq(BaseModel):
    token: str
    version: Optional[int] = None


# -----------------------------
# DB helpers
# -----------------------------
def get_interview_by_token(token: str) -> sqlite3.Row:
    conn = db()
    row = conn.execute("SELECT * FROM interviews WHERE token = ?", (token,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Invalid token")
    return row


def set_interview_stage(interview_id: str, stage: str) -> None:
    if stage not in ALL_STAGES:
        raise ValueError(f"Invalid stage: {stage}")
    conn = db()
    conn.execute("UPDATE interviews SET stage=?, updated_at=? WHERE id=?", (stage, now_iso(), interview_id))
    conn.commit()
    conn.close()


def update_progress(interview_id: str, progress: Dict[str, Any]) -> None:
    conn = db()
    conn.execute(
        "UPDATE interviews SET progress_json=?, updated_at=? WHERE id=?",
        (json.dumps(progress, ensure_ascii=False), now_iso(), interview_id),
    )
    conn.commit()
    conn.close()


def parse_progress(iv: sqlite3.Row) -> Dict[str, Any]:
    raw = iv["progress_json"]
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = {}
    return normalize_progress(data)


def add_message(interview_id: str, role: str, content: str, meta: Optional[Dict[str, Any]] = None) -> List[str]:
    sanitized, local_flags = redact_text(content)
    conn = db()
    conn.execute(
        "INSERT INTO messages (id, interview_id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            interview_id,
            role,
            sanitized,
            json.dumps(meta or {}, ensure_ascii=False),
            now_iso(),
        ),
    )
    conn.execute("UPDATE interviews SET updated_at=? WHERE id=?", (now_iso(), interview_id))
    conn.commit()
    conn.close()
    return local_flags


def fetch_recent_messages(interview_id: str, limit: int = 18) -> List[Dict[str, str]]:
    conn = db()
    rows = conn.execute(
        "SELECT role, content FROM messages WHERE interview_id=? ORDER BY created_at DESC LIMIT ?",
        (interview_id, limit),
    ).fetchall()
    conn.close()
    rows = list(reversed(rows))
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def fetch_all_user_excerpts(interview_id: str, max_items: int = 80, max_chars: int = 40000) -> List[str]:
    conn = db()
    rows = conn.execute(
        "SELECT content FROM messages WHERE interview_id=? AND role='user' ORDER BY created_at ASC",
        (interview_id,),
    ).fetchall()
    conn.close()

    excerpts: List[str] = []
    total = 0
    for r in rows:
        text = (r["content"] or "").strip()
        if not text:
            continue
        if total + len(text) > max_chars:
            break
        excerpts.append(text)
        total += len(text)
        if len(excerpts) >= max_items:
            break
    return excerpts


def upsert_memory(interview_id: str, key: str, value: Any, confidence: float) -> None:
    payload = {"value": value, "confidence": float(confidence)}
    conn = db()
    conn.execute(
        "INSERT INTO memory_facts (interview_id, key, value_json, updated_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(interview_id, key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
        (interview_id, key, json.dumps(payload, ensure_ascii=False), now_iso()),
    )
    conn.commit()
    conn.close()


def get_all_memory(interview_id: str) -> Dict[str, Any]:
    conn = db()
    rows = conn.execute("SELECT key, value_json FROM memory_facts WHERE interview_id=?", (interview_id,)).fetchall()
    conn.close()
    out: Dict[str, Any] = {}
    for r in rows:
        try:
            out[r["key"]] = json.loads(r["value_json"])
        except Exception:
            continue
    return out


def add_audit_event(interview_id: str, event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
    conn = db()
    conn.execute(
        "INSERT INTO audit_events (id, interview_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            interview_id,
            event_type,
            json.dumps(payload or {}, ensure_ascii=False),
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()


def get_artifact_version(interview_id: str, artifact_type: str = "draft") -> int:
    conn = db()
    row = conn.execute(
        "SELECT MAX(version) AS v FROM artifacts WHERE interview_id=? AND type=?",
        (interview_id, artifact_type),
    ).fetchone()
    conn.close()
    return int((row["v"] if row else 0) or 0)


def save_artifact(interview_id: str, content: str, artifact_type: str = "draft", meta: Optional[Dict[str, Any]] = None) -> int:
    version = get_artifact_version(interview_id, artifact_type=artifact_type) + 1
    conn = db()
    conn.execute(
        "INSERT INTO artifacts (id, interview_id, type, content, version, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            interview_id,
            artifact_type,
            content,
            version,
            json.dumps(meta or {}, ensure_ascii=False),
            now_iso(),
        ),
    )
    conn.execute("UPDATE interviews SET updated_at=? WHERE id=?", (now_iso(), interview_id))
    conn.commit()
    conn.close()
    return version


def latest_artifact(interview_id: str, artifact_type: str = "draft") -> Optional[sqlite3.Row]:
    conn = db()
    row = conn.execute(
        "SELECT * FROM artifacts WHERE interview_id=? AND type=? ORDER BY version DESC LIMIT 1",
        (interview_id, artifact_type),
    ).fetchone()
    conn.close()
    return row


def merge_coverage(stage_progress: Dict[str, Any], updates: Dict[str, List[str]]) -> Dict[str, Any]:
    for field in COVERAGE_FIELDS:
        incoming = updates.get(field, [])
        if not isinstance(incoming, list):
            continue
        merged = unique_strs([*(stage_progress.get(field, [])), *incoming])
        stage_progress[field] = merged
    stage_progress["turns"] = int(stage_progress.get("turns", 0)) + 1
    return stage_progress


def consent_payload(agreed: bool) -> Dict[str, Any]:
    return {
        "agreed": agreed,
        "agreed_at": now_iso() if agreed else None,
        "version": "2026-03-01",
        "notice": INVITATION_NOTICE,
    }


def has_consent(iv: sqlite3.Row) -> bool:
    # Legacy interviews: stage already advanced implies consent was implicitly given.
    if iv["consented_at"]:
        return True
    stage = iv["stage"]
    return stage in ACTIVE_STAGES or stage in ["review", "done"]


def fail_stage_guard(iv: sqlite3.Row) -> None:
    stage = iv["stage"]
    if stage == "withdrawn":
        raise HTTPException(status_code=409, detail="Interview has been withdrawn")
    if stage == "consent_pending":
        raise HTTPException(status_code=409, detail="Consent required before interview")
    if stage == "done":
        raise HTTPException(status_code=409, detail="Interview already finalized")


def safe_questions_for_stage(stage: str, missing: List[str]) -> List[str]:
    if stage == "daily":
        return ["回到最近一次学习场景，你当时用的是什么平台、学了什么、大概在几点？"]
    if stage == "evolution":
        return ["你能讲一个从求学到工作（或不同阶段）学习方式明显变化的具体节点吗？"]
    if stage == "experience":
        return ["挑一段最难忘的数字学习经历，说说当时发生了什么、你具体感受如何？"]
    if stage == "difficulty":
        return ["最近一次学习受阻是什么情况？你试了哪些方法，哪个有效或无效？"]
    if stage == "impact":
        return ["数字学习对你最近一段时间的学业/工作/关系有过哪些具体影响？"]
    if stage == "wrapup" and missing:
        return [f"收尾前还差这部分信息：{missing[0]}。你愿意补充一个具体例子吗？"]
    return ["还有没有你觉得必须写进自传、但我还没问到的关键经历？"]


def run_next_step(iv: sqlite3.Row) -> NextQuestionResp:
    fail_stage_guard(iv)

    interview_id = iv["id"]
    stage = iv["stage"]
    progress = parse_progress(iv)
    memory = get_all_memory(interview_id)
    recent = fetch_recent_messages(interview_id, limit=18)

    if stage not in ACTIVE_STAGES:
        raise HTTPException(status_code=409, detail=f"Stage '{stage}' cannot generate next question")

    stage_progress = progress.get(stage, blank_stage_progress())

    try:
        out = orchestrate_next(stage=stage, recent_msgs=recent, memory=memory, progress=progress)
    except Exception as exc:
        ready, missing = evaluate_stage_ready(stage, stage_progress)
        questions = safe_questions_for_stage(stage, missing)
        add_message(interview_id, "assistant", "\n".join([f"1. {q}" for q in questions]), {"fallback": True})
        add_audit_event(interview_id, "llm_orchestrator_error", {"error": str(exc)})
        return NextQuestionResp(
            stage=stage,
            questions=questions,
            followup_intent="fallback_question",
            should_advance_stage=False,
            suggested_next_stage=stage,
            risk_flags=["NONE"],
            rights_notice="你可以跳过任何问题，或随时撤回访谈。",
            stage_ready=ready,
            missing_requirements=missing,
        )

    for mu in out.get("memory_updates", []):
        key = str(mu.get("key", "")).strip()
        value = str(mu.get("value", "")).strip()
        conf = float(mu.get("confidence", 0.5))
        if not key or not value:
            continue
        redacted_value, _ = redact_text(value)
        upsert_memory(interview_id, key, redacted_value, conf)

    coverage_updates = out.get("coverage_updates", {}) if isinstance(out.get("coverage_updates", {}), dict) else {}
    stage_progress = merge_coverage(stage_progress, coverage_updates)
    ready, missing = evaluate_stage_ready(stage, stage_progress)
    stage_progress["ready"] = ready
    progress[stage] = stage_progress
    update_progress(interview_id, progress)

    suggested = out.get("suggested_next_stage", stage)
    should_advance = bool(out.get("should_advance_stage", False)) and ready

    if should_advance:
        if suggested == "done":
            suggested = "wrapup"
        if suggested not in ACTIVE_STAGES:
            suggested = next_stage(stage)
        set_interview_stage(interview_id, suggested)

    questions = unique_strs(out.get("next_questions", []) or safe_questions_for_stage(stage, missing), limit=2)
    if not questions:
        questions = safe_questions_for_stage(stage, missing)

    # If model wants to move on but requirement not met, ask a deterministic补问。
    if bool(out.get("should_advance_stage", False)) and not ready:
        questions = safe_questions_for_stage(stage, missing)
        should_advance = False
        suggested = stage

    risk_flags = unique_strs(out.get("risk_flags", []), limit=5)
    if not risk_flags:
        risk_flags = ["NONE"]

    rights_notice = str(out.get("rights_reminder", "")).strip() or "你可以跳过任何问题，或随时撤回访谈。"

    q_text = "\n".join([f"{i + 1}. {q}" for i, q in enumerate(questions)])
    add_message(interview_id, "assistant", q_text, {"stage": stage, "missing": missing, "ready": ready})

    add_audit_event(
        interview_id,
        "next_generated",
        {
            "stage": stage,
            "ready": ready,
            "missing": missing,
            "advanced": should_advance,
            "suggested_next_stage": suggested,
        },
    )

    return NextQuestionResp(
        stage=stage,
        questions=questions,
        followup_intent=str(out.get("followup_intent", "")),
        should_advance_stage=should_advance,
        suggested_next_stage=suggested,
        risk_flags=risk_flags,
        rights_notice=rights_notice,
        stage_ready=ready,
        missing_requirements=missing,
    )


# -----------------------------
# FastAPI
# -----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Digital Learning Autobiography Interview", version="2.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def read_index():
    return FileResponse("static/index.html")


@app.get("/healthz")
def healthz():
    return {"ok": True, "ts": now_iso()}


@app.post("/interviews", response_model=CreateInterviewResp)
def create_interview():
    interview_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    progress = blank_progress()
    created_at = now_iso()

    conn = db()
    conn.execute(
        """
        INSERT INTO interviews (
          id, token, stage, progress_json, consent_json,
          created_at, updated_at, completed_at, withdrawn_at, consented_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
        """,
        (
            interview_id,
            token,
            "consent_pending",
            json.dumps(progress, ensure_ascii=False),
            json.dumps(consent_payload(False), ensure_ascii=False),
            created_at,
            created_at,
        ),
    )
    conn.commit()
    conn.close()

    add_message(
        interview_id,
        "assistant",
        INVITATION_NOTICE
        + "\n\n如果你同意参与，请点击“我同意并开始”。如果不同意，可以直接退出或点击撤回。",
        {"type": "invitation_notice"},
    )
    add_audit_event(interview_id, "interview_created", {"stage": "consent_pending"})

    return CreateInterviewResp(
        interview_id=interview_id,
        token=token,
        stage="consent_pending",
        consent_required=True,
    )


@app.post("/consent")
def give_consent(req: ConsentReq):
    iv = get_interview_by_token(req.token)
    if iv["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="Interview already withdrawn")

    conn = db()
    if req.agreed:
        conn.execute(
            "UPDATE interviews SET consent_json=?, consented_at=?, stage=?, updated_at=? WHERE id=?",
            (
                json.dumps(consent_payload(True), ensure_ascii=False),
                now_iso(),
                "daily",
                now_iso(),
                iv["id"],
            ),
        )
        conn.commit()
        conn.close()

        add_message(
            iv["id"],
            "assistant",
            "感谢你同意参与。我们先从日常数字学习开始。\n"
            "1. 回想最近 48 小时内一次数字学习：你用了什么平台、学了什么、大概在几点？\n"
            "2. 这类学习通常在你一天中的哪个时段发生？",
            {"type": "consent_ack"},
        )
        add_audit_event(iv["id"], "consent_granted", {})
        return {"ok": True, "stage": "daily"}

    conn.execute(
        "UPDATE interviews SET consent_json=?, withdrawn_at=?, stage=?, updated_at=? WHERE id=?",
        (
            json.dumps(consent_payload(False), ensure_ascii=False),
            now_iso(),
            "withdrawn",
            now_iso(),
            iv["id"],
        ),
    )
    conn.commit()
    conn.close()

    add_message(iv["id"], "assistant", "已记录你不同意参与，本次访谈不会继续。", {"type": "consent_reject"})
    add_audit_event(iv["id"], "consent_rejected", {})
    return {"ok": True, "stage": "withdrawn"}


@app.post("/messages")
def post_message(req: PostMessageReq):
    iv = get_interview_by_token(req.token)
    fail_stage_guard(iv)

    if iv["stage"] not in ACTIVE_STAGES and iv["stage"] != "review":
        raise HTTPException(status_code=409, detail=f"Cannot post message at stage '{iv['stage']}'")

    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Empty content")

    flags = add_message(iv["id"], "user", content, {"stage": iv["stage"]})
    add_audit_event(iv["id"], "user_message", {"stage": iv["stage"], "risk_flags": flags})
    return {"ok": True, "risk_flags": flags or ["NONE"]}


@app.post("/skip")
def skip_question(req: SkipReq):
    iv = get_interview_by_token(req.token)
    fail_stage_guard(iv)
    if not is_active_interview_stage(iv["stage"]):
        raise HTTPException(status_code=409, detail=f"Cannot skip at stage '{iv['stage']}'")

    reason = req.reason.strip() if req.reason else ""
    content = "【受访者选择跳过此问题】"
    if reason:
        content += f" 原因：{reason}"
    add_message(iv["id"], "user", content, {"type": "skip", "stage": iv["stage"]})
    add_audit_event(iv["id"], "skip", {"stage": iv["stage"], "reason": reason})
    return run_next_step(get_interview_by_token(req.token))


@app.post("/next", response_model=NextQuestionResp)
def next_question(token: str):
    iv = get_interview_by_token(token)
    return run_next_step(iv)


@app.post("/withdraw")
def withdraw(req: WithdrawReq):
    iv = get_interview_by_token(req.token)
    if iv["stage"] == "withdrawn":
        return {"ok": True, "stage": "withdrawn"}

    reason = (req.reason or "").strip()
    conn = db()
    conn.execute(
        "UPDATE interviews SET stage='withdrawn', withdrawn_at=?, updated_at=? WHERE id=?",
        (now_iso(), now_iso(), iv["id"]),
    )
    conn.commit()
    conn.close()

    add_message(iv["id"], "assistant", "已为你撤回访谈。若后续想恢复，请联系研究者。", {"type": "withdrawn"})
    add_audit_event(iv["id"], "withdrawn", {"reason": reason})
    return {"ok": True, "stage": "withdrawn"}


@app.post("/alternative-submissions")
def create_alternative_submission(req: AlternativeSubmissionReq):
    iv = get_interview_by_token(req.token)
    fail_stage_guard(iv)

    kind = req.submission_type.strip().lower()
    if kind not in {"audio", "video", "text_document"}:
        raise HTTPException(status_code=400, detail="submission_type must be audio/video/text_document")

    transcript = (req.transcript or "").strip()
    url = (req.url or "").strip()
    note = (req.note or "").strip()

    redacted_transcript = ""
    if transcript:
        redacted_transcript, _ = redact_text(transcript)

    conn = db()
    conn.execute(
        "INSERT INTO alternative_submissions (id, interview_id, submission_type, url, transcript, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), iv["id"], kind, url, redacted_transcript, note, now_iso()),
    )
    conn.commit()
    conn.close()

    if redacted_transcript:
        add_message(
            iv["id"],
            "user",
            f"【替代提交转写-{kind}】\n{redacted_transcript}",
            {"type": "alternative_submission"},
        )

    add_audit_event(iv["id"], "alternative_submission", {"type": kind, "has_transcript": bool(redacted_transcript), "has_url": bool(url)})
    return {"ok": True}


@app.post("/finalize", response_model=FinalizeResp)
def finalize(req: FinalizeReq):
    iv = get_interview_by_token(req.token)

    if iv["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="Interview withdrawn")
    if not has_consent(iv):
        raise HTTPException(status_code=409, detail="Consent required")

    progress = parse_progress(iv)
    readiness = evaluate_overall_readiness(progress)

    if not req.force and not readiness["all_ready"]:
        missing: List[str] = []
        for stage in ACTIVE_STAGES:
            miss = readiness["stages"][stage]["missing"]
            if miss:
                missing.extend([f"{stage}: {m}" for m in miss])
        raise HTTPException(
            status_code=400,
            detail={
                "message": "访谈信息覆盖不足，暂不建议直接生成终稿。",
                "missing_requirements": missing,
            },
        )

    interview_id = iv["id"]
    memory = get_all_memory(interview_id)
    excerpts = fetch_all_user_excerpts(interview_id)

    if not excerpts:
        raise HTTPException(status_code=400, detail="No participant content yet")

    try:
        content = synthesize_autobiography(memory=memory, progress=progress, excerpts=excerpts)
    except Exception as exc:
        add_audit_event(interview_id, "llm_writer_error", {"error": str(exc)})
        raise HTTPException(status_code=503, detail="Failed to generate autobiography")

    content, _ = redact_text(content)
    version = save_artifact(
        interview_id,
        content,
        artifact_type="draft",
        meta={"readiness": readiness, "forced": req.force},
    )

    conn = db()
    conn.execute("UPDATE interviews SET stage='review', updated_at=?, completed_at=NULL WHERE id=?", (now_iso(), interview_id))
    conn.commit()
    conn.close()

    add_audit_event(interview_id, "draft_generated", {"version": version, "forced": req.force})
    return FinalizeResp(interview_id=interview_id, version=version, content=content, stage="review")


@app.post("/revise-final", response_model=FinalizeResp)
def revise_final(req: ReviseFinalReq):
    iv = get_interview_by_token(req.token)
    if iv["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="Interview withdrawn")
    instruction = req.instruction.strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="instruction is required")

    interview_id = iv["id"]
    memory = get_all_memory(interview_id)
    progress = parse_progress(iv)
    excerpts = fetch_all_user_excerpts(interview_id)

    latest = latest_artifact(interview_id, artifact_type="draft")
    if latest:
        excerpts.append(f"【上一版草稿】\n{latest['content']}")

    try:
        content = synthesize_autobiography(
            memory=memory,
            progress=progress,
            excerpts=excerpts,
            revision_note=instruction,
        )
    except Exception:
        raise HTTPException(status_code=503, detail="Failed to revise draft")

    content, _ = redact_text(content)
    version = save_artifact(interview_id, content, artifact_type="draft", meta={"revision_instruction": instruction})

    conn = db()
    conn.execute("UPDATE interviews SET stage='review', updated_at=?, completed_at=NULL WHERE id=?", (now_iso(), interview_id))
    conn.commit()
    conn.close()

    add_audit_event(interview_id, "draft_revised", {"version": version})
    return FinalizeResp(interview_id=interview_id, version=version, content=content, stage="review")


@app.post("/approve-final")
def approve_final(req: ApproveFinalReq):
    iv = get_interview_by_token(req.token)
    if iv["stage"] == "withdrawn":
        raise HTTPException(status_code=409, detail="Interview withdrawn")

    art = latest_artifact(iv["id"], artifact_type="draft")
    if not art:
        raise HTTPException(status_code=400, detail="No draft available")

    if req.version is not None and int(req.version) != int(art["version"]):
        raise HTTPException(status_code=409, detail="Requested version is not latest")

    final_version = save_artifact(iv["id"], art["content"], artifact_type="final", meta={"source_draft_version": art["version"]})

    conn = db()
    conn.execute(
        "UPDATE interviews SET stage='done', completed_at=?, updated_at=? WHERE id=?",
        (now_iso(), now_iso(), iv["id"]),
    )
    conn.commit()
    conn.close()

    add_audit_event(iv["id"], "final_approved", {"final_version": final_version, "source_draft_version": art["version"]})
    return {"ok": True, "stage": "done", "final_version": final_version}


@app.get("/export")
def export_interview(token: str):
    iv = get_interview_by_token(token)
    interview_id = iv["id"]

    conn = db()
    msgs = conn.execute(
        "SELECT role, content, meta_json, created_at FROM messages WHERE interview_id=? ORDER BY created_at ASC",
        (interview_id,),
    ).fetchall()
    drafts = conn.execute(
        "SELECT type, version, content, meta_json, created_at FROM artifacts WHERE interview_id=? ORDER BY type, version DESC",
        (interview_id,),
    ).fetchall()
    mem = conn.execute(
        "SELECT key, value_json, updated_at FROM memory_facts WHERE interview_id=?",
        (interview_id,),
    ).fetchall()
    alts = conn.execute(
        "SELECT submission_type, url, transcript, note, created_at FROM alternative_submissions WHERE interview_id=? ORDER BY created_at ASC",
        (interview_id,),
    ).fetchall()
    audit = conn.execute(
        "SELECT event_type, payload_json, created_at FROM audit_events WHERE interview_id=? ORDER BY created_at ASC",
        (interview_id,),
    ).fetchall()
    conn.close()

    progress = parse_progress(iv)
    readiness = evaluate_overall_readiness(progress)

    return {
        "interview": dict(iv),
        "progress": progress,
        "readiness": readiness,
        "messages": [dict(r) for r in msgs],
        "memory": [dict(r) for r in mem],
        "artifacts": [dict(r) for r in drafts],
        "alternative_submissions": [dict(r) for r in alts],
        "audit_events": [dict(r) for r in audit],
    }

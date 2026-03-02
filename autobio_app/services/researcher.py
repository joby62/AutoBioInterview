import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from ..config import SETTINGS
from ..db import DB, now_iso
from ..llm import LLM
from ..prompts import ACTIVE_STAGES, DEFAULT_TEMPLATE, TEMPLATE_SCHEMA, TEMPLATE_SYSTEM_PROMPT, stage_map
from ..security import hash_password, new_token, verify_password


PUBLIC_SAMPLE_INVITE_CODE = "sample-cuc-2026"
PUBLIC_SAMPLE_OWNER_EMAIL = "__public_sample__@autobio.local"
PUBLIC_SAMPLE_PARTICIPANT_TOKEN = "sample-demo-session"
PUBLIC_SAMPLE_TITLE = "示例项目｜中国传媒大学数字学习自传访谈（公开学习）"
PUBLIC_SAMPLE_INVITATION = (
    "【数字学习自传访谈邀请函】\n"
    "您好！我们正在开展“中国传媒大学数字学习自传”研究，关注学习者在数字平台中的真实学习经历。\n\n"
    "访谈将围绕以下内容展开：\n"
    "1. 日常学习场景（平台、时间、内容、时长）；\n"
    "2. 学习方式的变化节点与原因；\n"
    "3. 学习过程中的体验、情绪、困难与应对；\n"
    "4. 数字学习对学业、工作、生活与自我认同的影响。\n\n"
    "参与说明：\n"
    "- 访谈约 20-35 分钟；\n"
    "- 你可随时跳过问题、暂停或退出；\n"
    "- 内容仅用于学术研究，发布前会进行匿名化处理。\n\n"
    "感谢你的参与与分享。"
)
PUBLIC_SAMPLE_SUMMARY = (
    "我是中国传媒大学的一名学生。我的数字学习通常发生在晚上和周末，常用的平台是 B 站、MOOC 和 ChatGPT。"
    "以前我主要靠碎片化刷内容，后来在课程与实习压力下改为问题驱动学习：先列问题，再用平台素材和 AI 工具整理答案。\n\n"
    "对我来说，数字学习既带来效率，也带来焦虑。效率来自于检索和总结速度明显提升；焦虑来自于信息过载和“学不完”的压力。"
    "我会通过限时学习、每周复盘和固定笔记模板来应对分心和拖延，这些方法帮助我把学习从临时冲刺变成可持续节奏。\n\n"
    "这种学习方式不仅提升了课程表现，也改变了我看待知识的方式：我更愿意主动提问、输出观点，并把学习和真实任务连接起来。"
    "同时我也意识到要给自己留出休息空间，避免被“高效”绑架。"
)
PUBLIC_SAMPLE_MESSAGES: List[Dict[str, Any]] = [
    {
        "role": "assistant",
        "content": "欢迎参与数字学习自传访谈。你可以跳过任何问题、暂停或中途退出。回答越具体，最终自传越真实。\n\n如果你同意参与，请点击“我同意并开始”。",
        "meta": {"type": "invitation"},
    },
    {
        "role": "assistant",
        "content": "感谢同意参与，我们先从日常学习场景开始。\n1. 回忆最近48小时的一次数字学习\n2. 说明你常见的学习时段和频率",
        "meta": {"type": "consent_ack", "stage": "daily"},
    },
    {
        "role": "user",
        "content": "最近一次是昨晚11点，我在B站看数据新闻课程40分钟，之后用ChatGPT把重点整理成3条笔记。",
        "meta": {"stage": "daily"},
    },
    {
        "role": "assistant",
        "content": "这个节奏很清晰。你工作日和周末的学习安排有什么差异？",
        "meta": {"stage": "daily"},
    },
    {
        "role": "user",
        "content": "工作日主要是碎片化学习，通勤和睡前各20分钟；周末会完整留出2小时做系统复盘。",
        "meta": {"stage": "daily"},
    },
    {
        "role": "assistant",
        "content": "你刚才提到学习节奏有变化。能具体说说变化前后分别怎么学吗？另外，是什么事件触发了这次变化？",
        "meta": {"stage": "evolution"},
    },
    {
        "role": "user",
        "content": "以前我只刷推荐内容，学完就忘。去年准备实习时吃过一次亏，之后改成先列问题再找资料，效率明显提高。",
        "meta": {"stage": "evolution"},
    },
    {
        "role": "assistant",
        "content": "挑一段最难忘的数字学习经历，具体讲讲当时发生了什么。那一刻你的感受是什么，背后原因是什么？",
        "meta": {"stage": "experience"},
    },
    {
        "role": "user",
        "content": "最难忘的是第一次用AI帮我搭建复习提纲，当时很兴奋，但也担心自己会依赖工具不再深度思考。",
        "meta": {"stage": "experience"},
    },
    {
        "role": "assistant",
        "content": "最近一次学习受阻发生在什么场景？你后来试了哪些方法来应对，哪些有效、哪些无效？",
        "meta": {"stage": "difficulty"},
    },
    {
        "role": "user",
        "content": "最大困难是信息过载和分心。我用番茄钟+每周复盘来控制输入量，短期有效，但压力大时还会失控。",
        "meta": {"stage": "difficulty"},
    },
    {
        "role": "assistant",
        "content": "数字学习最近给你带来的一个积极影响是什么？同时它有没有带来一个让你矛盾或有压力的影响？",
        "meta": {"stage": "impact"},
    },
    {
        "role": "user",
        "content": "积极影响是表达和输出能力提高了；矛盾点是效率提高后我反而更容易逼自己不停学习，休息质量下降。",
        "meta": {"stage": "impact"},
    },
    {
        "role": "assistant",
        "content": "还有什么关键经历没提到？是否有需要匿名化处理的细节？",
        "meta": {"stage": "wrapup"},
    },
    {
        "role": "user",
        "content": "请把具体课程名和社团名做匿名化处理。我没有其他补充，可以进入草稿阶段。",
        "meta": {"stage": "wrapup"},
    },
    {
        "role": "assistant",
        "content": "已生成本次访谈总结，可继续补充或结束。",
        "meta": {"type": "summary_ready"},
    },
    {
        "role": "assistant",
        "content": "已确认定稿，访谈完成。",
        "meta": {"type": "done"},
    },
]


def _parse_json(text: str, fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    try:
        return json.loads(text or "{}")
    except Exception:
        return fallback or {}


def _normalize_template(raw: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return DEFAULT_TEMPLATE

    opening_script = str(raw.get("opening_script") or DEFAULT_TEMPLATE["opening_script"]).strip()
    raw_stages = raw.get("stages") if isinstance(raw.get("stages"), list) else []

    normalized: List[Dict[str, Any]] = []
    default_stage_map = {s["key"]: s for s in DEFAULT_TEMPLATE["stages"]}

    by_key = {}
    for stage in raw_stages:
        if not isinstance(stage, dict):
            continue
        key = str(stage.get("key") or "").strip()
        if key in ACTIVE_STAGES:
            by_key[key] = stage

    for key in ACTIVE_STAGES:
        base = default_stage_map[key]
        src = by_key.get(key, {})
        hints = src.get("prompt_hints") if isinstance(src.get("prompt_hints"), list) else base["prompt_hints"]
        hints = [str(h).strip() for h in hints if str(h).strip()][:4]
        if len(hints) < 2:
            hints = base["prompt_hints"]

        min_turns = src.get("min_turns", base["min_turns"])
        min_chars = src.get("min_chars", base["min_chars"])
        try:
            min_turns = max(1, min(4, int(min_turns)))
        except Exception:
            min_turns = base["min_turns"]
        try:
            min_chars = max(20, min(120, int(min_chars)))
        except Exception:
            min_chars = base["min_chars"]

        normalized.append(
            {
                "key": key,
                "title": str(src.get("title") or base["title"]).strip(),
                "goal": str(src.get("goal") or base["goal"]).strip(),
                "prompt_hints": hints,
                "min_turns": min_turns,
                "min_chars": min_chars,
            }
        )

    return {
        "opening_script": opening_script,
        "stages": normalized,
    }


def _make_invite_code() -> str:
    return secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12]


def _is_public_sample_project(conn, project_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM invite_links WHERE project_id=? AND invite_code=? LIMIT 1",
        (project_id, PUBLIC_SAMPLE_INVITE_CODE),
    ).fetchone()
    return bool(row)


def _sample_progress(template: Dict[str, Any]) -> Dict[str, Any]:
    smap = stage_map(template)
    out: Dict[str, Any] = {}
    for key in ACTIVE_STAGES:
        conf = smap.get(key, {})
        min_turns = int(conf.get("min_turns", 1))
        min_chars = int(conf.get("min_chars", 20))
        turns = max(min_turns, 2 if key != "wrapup" else 1)
        chars = max(min_chars, 60 if key != "wrapup" else 28)
        out[key] = {
            "turns": turns,
            "chars": chars,
            "ready": True,
            "min_turns": min_turns,
            "min_chars": min_chars,
            "samples": [],
        }
    return out


def ensure_public_sample_project() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    template = _normalize_template(DEFAULT_TEMPLATE)
    progress = _sample_progress(template)
    seeded_new_demo = False
    seeded_project_id = ""
    seeded_session_id = ""

    with DB.session() as conn:
        owner = conn.execute("SELECT id FROM users WHERE email=?", (PUBLIC_SAMPLE_OWNER_EMAIL,)).fetchone()
        if owner:
            owner_id = owner["id"]
        else:
            owner_id = DB.uuid()
            conn.execute(
                "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'researcher', ?)",
                (owner_id, PUBLIC_SAMPLE_OWNER_EMAIL, hash_password(new_token(16)), created_at),
            )

        invite = conn.execute(
            "SELECT id, project_id FROM invite_links WHERE invite_code=? LIMIT 1",
            (PUBLIC_SAMPLE_INVITE_CODE,),
        ).fetchone()

        if invite:
            invite_id = invite["id"]
            project_id = invite["project_id"]
            conn.execute("UPDATE invite_links SET status='active', expires_at=NULL WHERE id=?", (invite_id,))
            conn.execute(
                """
                UPDATE projects
                SET owner_user_id=?, title=?, invitation_text=?, template_json=?, updated_at=?
                WHERE id=?
                """,
                (
                    owner_id,
                    PUBLIC_SAMPLE_TITLE,
                    PUBLIC_SAMPLE_INVITATION,
                    json.dumps(template, ensure_ascii=False),
                    created_at,
                    project_id,
                ),
            )
        else:
            project_id = DB.uuid()
            invite_id = DB.uuid()
            conn.execute(
                """
                INSERT INTO projects (id, owner_user_id, title, invitation_text, template_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    owner_id,
                    PUBLIC_SAMPLE_TITLE,
                    PUBLIC_SAMPLE_INVITATION,
                    json.dumps(template, ensure_ascii=False),
                    created_at,
                    created_at,
                ),
            )
            conn.execute(
                """
                INSERT INTO invite_links (id, project_id, invite_code, status, created_at, expires_at)
                VALUES (?, ?, ?, 'active', ?, NULL)
                """,
                (invite_id, project_id, PUBLIC_SAMPLE_INVITE_CODE, created_at),
            )

        demo = conn.execute(
            """
            SELECT id
            FROM interview_sessions
            WHERE project_id=? AND participant_token=?
            LIMIT 1
            """,
            (project_id, PUBLIC_SAMPLE_PARTICIPANT_TOKEN),
        ).fetchone()
        if not demo:
            session_id = DB.uuid()
            conn.execute(
                """
                INSERT INTO interview_sessions (
                  id, project_id, invite_id, participant_token, stage, progress_json,
                  consented_at, withdrawn_at, summary_text, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'done', ?, ?, NULL, ?, ?, ?)
                """,
                (
                    session_id,
                    project_id,
                    invite_id,
                    PUBLIC_SAMPLE_PARTICIPANT_TOKEN,
                    json.dumps(progress, ensure_ascii=False),
                    created_at,
                    PUBLIC_SAMPLE_SUMMARY,
                    created_at,
                    created_at,
                ),
            )
            seeded_new_demo = True
            seeded_project_id = project_id
            seeded_session_id = session_id
        else:
            session_id = demo["id"]
            conn.execute(
                """
                UPDATE interview_sessions
                SET invite_id=?, stage='done', progress_json=?, consented_at=?, withdrawn_at=NULL, summary_text=?, updated_at=?
                WHERE id=?
                """,
                (
                    invite_id,
                    json.dumps(progress, ensure_ascii=False),
                    created_at,
                    PUBLIC_SAMPLE_SUMMARY,
                    created_at,
                    session_id,
                ),
            )

        conn.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
        base = now - timedelta(minutes=18)
        for idx, msg in enumerate(PUBLIC_SAMPLE_MESSAGES):
            ts = (base + timedelta(seconds=idx * 35)).isoformat()
            conn.execute(
                """
                INSERT INTO messages (id, session_id, role, content, meta_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    DB.uuid(),
                    session_id,
                    msg.get("role", "assistant"),
                    msg.get("content", ""),
                    json.dumps(msg.get("meta", {}), ensure_ascii=False),
                    ts,
                ),
            )

    if seeded_new_demo:
        DB.add_audit(
            project_id=seeded_project_id,
            session_id=seeded_session_id,
            actor_type="system",
            actor_id="sample-seeder",
            event_type="sample_project_seeded",
            payload={"invite_code": PUBLIC_SAMPLE_INVITE_CODE},
        )

    return {"project_id": project_id, "invite_code": PUBLIC_SAMPLE_INVITE_CODE}


def register_researcher(email: str, password: str) -> Dict[str, Any]:
    email = email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="请输入有效邮箱")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码至少 8 位")

    with DB.session() as conn:
        exists = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="该邮箱已注册")

        user_id = DB.uuid()
        conn.execute(
            "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, 'researcher', ?)",
            (user_id, email, hash_password(password), now_iso()),
        )

    DB.add_audit(
        project_id=None,
        session_id=None,
        actor_type="researcher",
        actor_id=user_id,
        event_type="researcher_registered",
        payload={"email": email},
    )
    return {"id": user_id, "email": email}


def create_researcher_session(email: str, password: str) -> Tuple[Dict[str, Any], str, str]:
    email = email.strip().lower()
    with DB.session() as conn:
        user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="账号或密码错误")
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="账号或密码错误")

        token = new_token(24)
        created = now_iso()
        expires_dt = datetime.now(timezone.utc) + timedelta(hours=SETTINGS.researcher_session_hours)
        expires_at = expires_dt.isoformat()

        conn.execute(
            """
            INSERT INTO researcher_sessions (id, user_id, session_token, created_at, expires_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (DB.uuid(), user["id"], token, created, expires_at, created),
        )

    DB.add_audit(
        project_id=None,
        session_id=None,
        actor_type="researcher",
        actor_id=user["id"],
        event_type="researcher_login",
        payload={"email": email},
    )
    return {"id": user["id"], "email": user["email"]}, token, expires_at


def get_researcher_by_session(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None

    with DB.session() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, rs.id AS session_id, rs.expires_at
            FROM researcher_sessions rs
            JOIN users u ON u.id = rs.user_id
            WHERE rs.session_token=?
            """,
            (token,),
        ).fetchone()
        if not row:
            return None

        expires_at = row["expires_at"]
        try:
            if datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
                conn.execute("DELETE FROM researcher_sessions WHERE id=?", (row["session_id"],))
                return None
        except Exception:
            return None

        conn.execute("UPDATE researcher_sessions SET last_seen_at=? WHERE id=?", (now_iso(), row["session_id"]))

    return {"id": row["id"], "email": row["email"]}


def delete_researcher_session(token: str) -> None:
    if not token:
        return
    with DB.session() as conn:
        conn.execute("DELETE FROM researcher_sessions WHERE session_token=?", (token,))


def _generate_template(invitation_text: str) -> Dict[str, Any]:
    invitation_text = invitation_text.strip()
    if not invitation_text:
        return DEFAULT_TEMPLATE

    user_payload = json.dumps(
        {
            "invitation_text": invitation_text,
            "requirements": {
                "stages_order": ACTIVE_STAGES,
                "target": "以邀请函为核心诉求，帮助受访者产出可用自传素材",
            },
        },
        ensure_ascii=False,
    )

    try:
        raw = LLM.json(
            system_prompt=TEMPLATE_SYSTEM_PROMPT,
            user_text=user_payload,
            schema=TEMPLATE_SCHEMA,
            model=SETTINGS.default_model,
        )
    except Exception:
        return DEFAULT_TEMPLATE

    return _normalize_template(raw)


def create_project(owner_user_id: str, title: str, invitation_text: str) -> Dict[str, Any]:
    title = (title or "").strip() or "未命名访谈项目"
    invitation_text = (invitation_text or "").strip()
    if not invitation_text:
        raise HTTPException(status_code=400, detail="请填写邀请函内容")

    template = _generate_template(invitation_text)
    project_id = DB.uuid()
    invite_id = DB.uuid()

    invite_code = _make_invite_code()
    created_at = now_iso()

    with DB.session() as conn:
        conn.execute(
            """
            INSERT INTO projects (id, owner_user_id, title, invitation_text, template_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (project_id, owner_user_id, title, invitation_text, json.dumps(template, ensure_ascii=False), created_at, created_at),
        )
        conn.execute(
            """
            INSERT INTO invite_links (id, project_id, invite_code, status, created_at, expires_at)
            VALUES (?, ?, ?, 'active', ?, NULL)
            """,
            (invite_id, project_id, invite_code, created_at),
        )

    DB.add_audit(
        project_id=project_id,
        session_id=None,
        actor_type="researcher",
        actor_id=owner_user_id,
        event_type="project_created",
        payload={"title": title, "invite_code": invite_code},
    )

    return {
        "id": project_id,
        "title": title,
        "invitation_text": invitation_text,
        "template": template,
        "invite_code": invite_code,
        "created_at": created_at,
    }


def list_projects(owner_user_id: str) -> List[Dict[str, Any]]:
    with DB.session() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.title, p.created_at, p.updated_at,
                   l.invite_code,
                   CASE
                     WHEN EXISTS (
                       SELECT 1 FROM invite_links x
                       WHERE x.project_id = p.id AND x.invite_code = ?
                     ) THEN 1 ELSE 0
                   END AS is_public_sample,
                   COUNT(DISTINCT s.id) AS sessions_count
            FROM projects p
            LEFT JOIN invite_links l ON l.project_id = p.id AND l.status='active'
            LEFT JOIN interview_sessions s ON s.project_id = p.id
            WHERE p.owner_user_id=? OR p.id IN (
                SELECT project_id FROM invite_links WHERE invite_code=?
            )
            GROUP BY p.id, p.title, p.created_at, p.updated_at, l.invite_code
            ORDER BY p.updated_at DESC
            """,
            (PUBLIC_SAMPLE_INVITE_CODE, owner_user_id, PUBLIC_SAMPLE_INVITE_CODE),
        ).fetchall()
    return [dict(r) for r in rows]


def get_project_detail(owner_user_id: str, project_id: str) -> Dict[str, Any]:
    with DB.session() as conn:
        p = conn.execute(
            """
            SELECT p.*, l.invite_code
            FROM projects p
            LEFT JOIN invite_links l ON l.project_id = p.id AND l.status='active'
            WHERE p.id=?
            """,
            (project_id,),
        ).fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="项目不存在")
        if p["owner_user_id"] != owner_user_id and not _is_public_sample_project(conn, project_id):
            raise HTTPException(status_code=404, detail="项目不存在")

        sessions = conn.execute(
            """
            SELECT s.id, s.stage, s.consented_at, s.withdrawn_at, s.created_at, s.updated_at,
                   s.participant_token,
                   CASE WHEN s.participant_token=? THEN 1 ELSE 0 END AS is_sample_demo,
                   COUNT(m.id) AS message_count
            FROM interview_sessions s
            LEFT JOIN messages m ON m.session_id = s.id
            WHERE s.project_id=?
            GROUP BY s.id, s.participant_token
            ORDER BY is_sample_demo DESC, s.updated_at DESC
            """,
            (PUBLIC_SAMPLE_PARTICIPANT_TOKEN, project_id),
        ).fetchall()

    data = dict(p)
    data["template"] = _parse_json(data.get("template_json", "{}"), DEFAULT_TEMPLATE)
    data["sessions"] = [dict(r) for r in sessions]
    return data


def get_session_detail(owner_user_id: str, session_id: str) -> Dict[str, Any]:
    with DB.session() as conn:
        row = conn.execute(
            """
            SELECT s.*, p.id AS project_id, p.owner_user_id, p.title AS project_title
            FROM interview_sessions s
            JOIN projects p ON p.id = s.project_id
            WHERE s.id=?
            """,
            (session_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="会话不存在")
        if row["owner_user_id"] != owner_user_id and not _is_public_sample_project(conn, row["project_id"]):
            raise HTTPException(status_code=404, detail="会话不存在")

        msgs = conn.execute(
            "SELECT role, content, meta_json, created_at FROM messages WHERE session_id=? ORDER BY created_at ASC",
            (session_id,),
        ).fetchall()

    out = dict(row)
    out["progress"] = _parse_json(out.get("progress_json", "{}"), {})
    out["messages"] = [dict(r) for r in msgs]
    return out


def export_session(owner_user_id: str, session_id: str, fmt: str = "json") -> Tuple[str, str]:
    detail = get_session_detail(owner_user_id, session_id)
    messages = detail.get("messages", [])

    if fmt == "txt":
        lines = [
            f"项目: {detail.get('project_title', '-')}",
            f"会话: {session_id}",
            f"阶段: {detail.get('stage', '-')}",
            "",
            "=== 对话记录 ===",
        ]
        for m in messages:
            lines.append(f"[{m.get('created_at','')}] {m.get('role','')}: {m.get('content','')}")
        lines.append("\n=== 总结 ===")
        lines.append(detail.get("summary_text") or "尚未生成总结")
        return "text/plain; charset=utf-8", "\n".join(lines)

    payload = {
        "session": {k: v for k, v in detail.items() if k != "messages"},
        "messages": messages,
    }
    return "application/json; charset=utf-8", json.dumps(payload, ensure_ascii=False, indent=2)

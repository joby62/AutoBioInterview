import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    base_dir: Path
    db_path: Path
    ark_base_url: str
    ark_api_key: str
    default_model: str
    fallback_model: str
    cookie_researcher: str
    cookie_participant: str
    researcher_session_hours: int



def load_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent.parent
    db_path = Path(os.environ.get("DB_PATH", str(base_dir / "interviews.db"))).resolve()
    ark_api_key = (os.environ.get("ARK_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
    default_model = (
        os.environ.get("ARK_MODEL_DEFAULT")
        or os.environ.get("MODEL_ORCH")
        or "doubao-seed-2-0-mini-260215"
    ).strip()
    fallback_model = (
        os.environ.get("ARK_MODEL_FALLBACK")
        or os.environ.get("MODEL_WRITE")
        or "doubao-seed-2-0-lite-260215"
    ).strip()
    return Settings(
        app_name="AutoBio Interview Platform",
        app_version="3.0",
        base_dir=base_dir,
        db_path=db_path,
        ark_base_url=os.environ.get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
        ark_api_key=ark_api_key,
        default_model=default_model,
        fallback_model=fallback_model,
        cookie_researcher=os.environ.get("COOKIE_RESEARCHER", "abi_researcher_session"),
        cookie_participant=os.environ.get("COOKIE_PARTICIPANT", "abi_participant_token"),
        researcher_session_hours=int(os.environ.get("RESEARCHER_SESSION_HOURS", "72")),
    )


SETTINGS = load_settings()

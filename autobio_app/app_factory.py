from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS
from .db import DB, now_iso
from .model_runtime import get_model_config
from .routers import auth_router, participant_compat_router, participant_router, researcher_router
from .services.researcher import PUBLIC_SAMPLE_INVITE_CODE, ensure_public_sample_project


@asynccontextmanager
async def lifespan(app: FastAPI):
    DB.init()
    ensure_public_sample_project()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=SETTINGS.app_name, version=SETTINGS.app_version, lifespan=lifespan)
    app.mount("/static", StaticFiles(directory=str(SETTINGS.base_dir / "static")), name="static")

    app.include_router(auth_router)
    app.include_router(researcher_router)
    app.include_router(participant_router)
    app.include_router(participant_compat_router)

    @app.get("/")
    async def root_redirect():
        return RedirectResponse(url="/researcher", status_code=302)

    @app.get("/researcher")
    async def researcher_page():
        return FileResponse(str(SETTINGS.base_dir / "static" / "researcher.html"))

    @app.get("/participant/sample")
    async def participant_sample():
        return RedirectResponse(url=f"/participant/{PUBLIC_SAMPLE_INVITE_CODE}", status_code=302)

    @app.get("/participant/{invite_code}")
    async def participant_page(invite_code: str):
        # invite_code consumed by frontend from path.
        return FileResponse(str(SETTINGS.base_dir / "static" / "participant.html"))

    @app.get("/participant-direct")
    async def participant_direct():
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
        if not row:
            raise HTTPException(status_code=404, detail="暂无可用受访链接，请先在研究者界面创建项目")
        return RedirectResponse(url=f"/participant/{row['invite_code']}", status_code=302)

    @app.get("/healthz")
    async def healthz():
        return {
            "ok": True,
            "ts": now_iso(),
            "db": str(SETTINGS.db_path),
            "ark_base_url": SETTINGS.ark_base_url,
            "ark_api_key_present": bool(SETTINGS.ark_api_key),
            "models": get_model_config(),
        }

    return app

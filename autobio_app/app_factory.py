from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import SETTINGS

GUIDE_ROUTE = "/guides/yunnan"
GUIDE_FILE = SETTINGS.base_dir / "static" / "guide" / "yunnan.html"


def _guide_response() -> FileResponse:
    return FileResponse(str(GUIDE_FILE))


def create_app() -> FastAPI:
    app = FastAPI(title=SETTINGS.app_name, version=SETTINGS.app_version)
    app.mount("/static", StaticFiles(directory=str(SETTINGS.base_dir / "static")), name="static")

    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return RedirectResponse(url=GUIDE_ROUTE, status_code=302)

    @app.get(GUIDE_ROUTE, include_in_schema=False)
    async def yunnan_guide():
        return _guide_response()

    @app.get("/researcher", include_in_schema=False)
    @app.get("/participant-direct", include_in_schema=False)
    @app.get("/participant/sample", include_in_schema=False)
    async def legacy_redirect():
        return RedirectResponse(url=GUIDE_ROUTE, status_code=302)

    @app.get("/participant/{invite_code}", include_in_schema=False)
    @app.get("/m/participant/{invite_code}", include_in_schema=False)
    async def legacy_participant_redirect(_invite_code: str):
        return RedirectResponse(url=GUIDE_ROUTE, status_code=302)

    @app.get("/healthz")
    async def healthz():
        return {
            "ok": True,
            "route": GUIDE_ROUTE,
            "page": str(GUIDE_FILE.relative_to(SETTINGS.base_dir)),
        }

    return app

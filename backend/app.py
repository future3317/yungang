import json
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.dependencies import reconfigure
from backend.routers import archives, meta, rooms

app = FastAPI(title="Yungang Heritage Network", version="3.0")
_rate_buckets: dict[tuple[str, str], list[float]] = {}


def _rate_limit_category(path: str) -> str:
    if path == "/api/rooms":
        return "room-create"
    if not path.startswith("/api/rooms/"):
        return ""
    endpoint = path.rsplit("/", 1)[-1]
    if "/seats/" in path:
        return "room-control"
    return {
        "join": "room-join",
        "reconnect": "room-auth",
        "events-ticket": "room-auth",
        "start": "room-start",
        "ready": "room-control",
        "role": "room-control",
        "leave": "room-control",
        "pause": "room-control",
        "resume": "room-control",
        "actions": "room-action",
    }.get(endpoint, "")


def create_app(database_path: str | Path | None = None) -> FastAPI:
    """Return the API app, optionally pointing its runtime repository at an isolated database."""
    if database_path is not None:
        reconfigure(database_path)
        _rate_buckets.clear()
    return app


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    now = __import__("time").monotonic()
    if len(_rate_buckets) > 2048:
        _rate_buckets.update({key: stamps for key, stamps in _rate_buckets.items() if stamps and now - stamps[-1] < 60})
    category = _rate_limit_category(request.url.path)
    key = (request.client.host if request.client else "unknown", category)
    if request.method in {"POST", "PUT", "PATCH"} and category and os.getenv("YUNGANG_TEST_MODE") != "1":
        bucket = [stamp for stamp in _rate_buckets.get(key, []) if now - stamp < 60]
        if len(bucket) >= 30:
            return Response(
                content=json.dumps({"detail": {"code": "rate_limited", "message": "请求过于频繁，请稍后再试。"}}, ensure_ascii=False),
                status_code=429,
                media_type="application/json",
            )
        bucket.append(now)
        _rate_buckets[key] = bucket
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.include_router(meta.router)
app.include_router(archives.router)
app.include_router(rooms.router)


frontend_root = Path(__file__).resolve().parents[1] / "frontend"
frontend = frontend_root / "dist" if (frontend_root / "dist").exists() else frontend_root
ui_assets = frontend / "ui-assets"
if not ui_assets.is_dir():
    ui_assets = frontend_root / "static" / "ui-assets"


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: dict) -> Response:
        # Unknown /api/* paths must 404 instead of falling back to the SPA.
        # Real API routes are handled by FastAPI routers before this middleware.
        if path.startswith("api/"):
            return Response(
                content=json.dumps({"detail": "Not Found"}, ensure_ascii=False),
                status_code=404,
                media_type="application/json",
            )
        if scope.get("method") != "GET":
            return await super().get_response(path, scope)
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        if path.startswith("assets/"):
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        return response


app.mount("/", SPAStaticFiles(directory=frontend, html=True), name="frontend")

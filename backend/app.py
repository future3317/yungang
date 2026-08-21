from pathlib import Path
from uuid import uuid4
import asyncio
import json
import os
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from .actions import dispatch
from .content import Content
from .engine import GameEngine
from .models import ActionRequest, CreateGameRequest, GameState, RoomActionRequest, RoomCreateRequest, RoomJoinRequest, RoomReadyRequest, RoomReconnectRequest, RoomRoleRequest, RoomSeatUpdateRequest
from .repository import GameRepository
from .rooms import RoomRepository, RoomService

app = FastAPI(title="Yungang Heritage Network", version="3.0")
repo = GameRepository(os.getenv("YUNGANG_DATABASE_PATH"))
content = Content()
engine = GameEngine(content)
room_service = RoomService(RoomRepository(repo.path))
_rate_buckets: dict[tuple[str, str], list[float]] = {}


def create_app(database_path: str | Path | None = None) -> FastAPI:
    """Return the API app, optionally pointing its runtime repository at an isolated database."""
    global repo, room_service
    if database_path is not None:
        isolated = GameRepository(database_path)
        repo.path = isolated.path
        room_service.repository = RoomRepository(repo.path)
        _rate_buckets.clear()
    return app

@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    now = __import__("time").monotonic()
    key = (request.client.host if request.client else "unknown", request.url.path)
    if request.method in {"POST", "PUT", "PATCH"} and (request.url.path == "/api/rooms" or request.url.path.endswith("/join") or request.url.path.endswith("/actions")):
        bucket = [stamp for stamp in _rate_buckets.get(key, []) if now - stamp < 60]
        if len(bucket) >= 30:
            return Response(content=json.dumps({"detail": {"code": "rate_limited", "message": "请求过于频繁，请稍后再试。"}}, ensure_ascii=False), status_code=429, media_type="application/json")
        bucket.append(now)
        _rate_buckets[key] = bucket
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok", "service": "yungang-heritage-network", "database": "ready" if repo.path.exists() else "initializing"}

@app.get("/api/meta")
def meta():
    return {"schema_version": 3, "mode": "heritage_network", "domains": content.domains, "domain_meta": content.domain_meta, "terminology": content.terminology, "regions": content.regions, "scenarios": list(content.scenarios.values()), "roles": list(content.roles.values()), "sites": list(content.sites.values()), "facets": content.site_facets, "cards": list(content.cards.values()), "action_cards": list(content.action_cards.values()), "events": list(content.events.values()), "tasks": list(content.tasks.values()), "projects": list(content.projects.values()), "objectives": list(content.objectives.values()), "difficulty": list(content.difficulty.values())}

@app.post("/api/games", response_model=GameState)
def create_game(request: CreateGameRequest) -> GameState:
    session_id = f"game-{uuid4().hex[:10]}"
    seed = request.seed if request.seed is not None else request.daily_seed
    state = engine.new_game(session_id, request.player_ids, request.difficulty_id, request.scenario_id, seed)
    repo.save(state)
    return state

@app.get("/api/games/{session_id}", response_model=GameState)
def get_game(session_id: str) -> GameState:
    if room_service.room_for_session(session_id):
        raise HTTPException(403, {"code": "room_session_requires_seat_token", "message": "这段房间旅程需要通过房间入口访问。", "details": {}, "recovery": "return_to_room"})
    state = repo.get(session_id)
    if not state: raise HTTPException(404, {"code": "session_not_found", "message": "找不到这段旅程。", "details": {"session_id": session_id}, "recovery": "return_home"})
    return state

@app.post("/api/games/{session_id}/actions", response_model=GameState)
def game_action(session_id: str, request: ActionRequest) -> GameState:
    if room_service.room_for_session(session_id):
        raise HTTPException(403, {"code": "room_session_requires_seat_token", "message": "这段房间旅程需要通过房间入口操作。", "details": {}, "recovery": "return_to_room"})
    return _run_action(session_id, request)


def _run_action(session_id: str, request: ActionRequest) -> GameState:
    state = repo.get(session_id)
    if not state: raise HTTPException(404, {"code": "session_not_found", "message": "找不到这段旅程。", "details": {"session_id": session_id}, "recovery": "return_home"})
    if request.request_id and request.request_id in state.processed_request_ids:
        return state
    if request.expected_revision != state.revision:
        raise HTTPException(status_code=409, detail={"code": "revision_conflict", "message": "旅程状态已更新，请同步后重新选择行动。", "details": {"expected_revision": request.expected_revision, "actual_revision": state.revision}, "recovery": "sync_current_state", "current_state": state.model_dump()})
    expected_revision = request.expected_revision
    try:
        state = dispatch(engine, state, request)
    except ValueError as exc:
        code = str(exc)
        recovery = {"not_active_player": "wait_for_active_player", "invalid_route": "choose_another_action", "site_does_not_need_restoration": "inspect_site_status", "planning_not_active": "continue_current_phase", "game_is_over": "open_result"}.get(code, "choose_another_action")
        raise HTTPException(400, {"code": code, "message": content.terminology.get("errors", {}).get(code, code), "details": {}, "recovery": recovery}) from exc
    if not repo.save_if_revision(state, expected_revision):
        current = repo.get(session_id)
        raise HTTPException(status_code=409, detail={"code": "revision_conflict", "current_state": current.model_dump() if current else None})
    return state


def _room_or_404(room_id: str) -> dict:
    room = room_service.repository.get(room_id)
    if not room:
        raise HTTPException(404, {"code": "room_not_found", "message": "找不到这间旅舍。", "details": {"room_id": room_id}, "recovery": "return_home"})
    return room


def _room_token_error(exc: ValueError) -> HTTPException:
    code = str(exc)
    status = 401 if code in {"seat_token_required", "invalid_seat_token"} else 400
    messages = {"seat_token_required": "请使用席位凭证进入这间旅舍。", "invalid_seat_token": "席位凭证已失效，请重新加入房间。", "room_not_joinable": "这间旅舍已经开始旅程。", "room_not_started": "旅程尚未点亮，当前不能恢复席位。", "room_full": "旅舍席位已满。", "seat_not_found": "找不到要恢复的席位。", "role_already_taken": "这个角色已经被同行者选走。", "room_already_started": "旅程开始后不能离开席位。"}
    return HTTPException(status, {"code": code, "message": messages.get(code, "房间操作无法完成。"), "details": {}, "recovery": "return_to_room"})


@app.post("/api/rooms")
def create_room(request: RoomCreateRequest):
    room, host_token, seat_token = room_service.create(f"room-{uuid4().hex[:16]}", request)
    return {"room": room_service.public(room, seat_token), "host_token": host_token, "seat_token": seat_token}


@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/join")
def join_room(room_id: str, request: RoomJoinRequest):
    room = _room_or_404(room_id)
    try:
        room, seat_token, _ = room_service.join(room, request.name, request.role_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"room": room_service.public(room, seat_token), "seat_token": seat_token}


@app.post("/api/rooms/{room_id}/reconnect")
def reconnect_room(room_id: str, request: RoomReconnectRequest):
    room = _room_or_404(room_id)
    try:
        room, seat_token = room_service.reconnect(room, request.seat_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"room": room_service.public(room, seat_token), "seat_token": seat_token}


@app.post("/api/rooms/{room_id}/ready")
def ready_room(room_id: str, request: RoomReadyRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        room_service.set_ready(room, x_seat_token or "", request.ready)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/role")
def role_room(room_id: str, request: RoomRoleRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    if request.role_id not in content.roles:
        raise HTTPException(400, {"code": "unknown_role", "message": "找不到这个角色。", "details": {}, "recovery": "choose_another_role"})
    try:
        room_service.set_role(room, x_seat_token or "", request.role_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/seats/{seat_id}")
def update_local_seat(room_id: str, seat_id: str, request: RoomSeatUpdateRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    if request.role_id is not None and request.role_id not in content.roles:
        raise HTTPException(400, {"code": "unknown_role", "message": "找不到这个角色。", "details": {}, "recovery": "choose_another_role"})
    try:
        room_service.update_local_seat(room, x_seat_token or "", seat_id, request.name, request.role_id, request.ready)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/leave")
def leave_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        room_service.leave(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


def _require_host(room: dict, token: str | None) -> None:
    try:
        seat = room_service.authenticate(room, token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    if seat["seat_id"] != "seat-1":
        raise HTTPException(403, {"code": "host_required", "message": "只有房主可以改变旅舍状态。", "details": {}, "recovery": "wait_for_host"})


@app.post("/api/rooms/{room_id}/pause")
def pause_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    _require_host(room, x_seat_token)
    if room["status"] == "in_progress":
        room["status"] = "paused"
        room_service.repository.save(room)
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/resume")
def resume_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    _require_host(room, x_seat_token)
    if room["status"] == "paused":
        room["status"] = "in_progress"
        room_service.repository.save(room)
    return room_service.public(room, x_seat_token)


@app.post("/api/rooms/{room_id}/start")
def start_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        host = room_service.authenticate(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    if host["seat_id"] != "seat-1":
        raise HTTPException(403, {"code": "host_required", "message": "只有房主可以点亮旅程。", "details": {}, "recovery": "wait_for_host"})
    if room["status"] != "lobby":
        return {"room": room_service.public(room, x_seat_token), "session_id": room.get("session_id")}
    if len(room["seats"]) != room["max_players"]:
        raise HTTPException(409, {"code": "room_not_full", "message": "席位尚未全部就绪。", "details": {}, "recovery": "wait_for_seats"})
    role_ids = [seat.get("role_id") for seat in room["seats"]]
    if not all(role_ids):
        raise HTTPException(409, {"code": "roles_required", "message": "请先为每个席位选择不同角色。", "details": {}, "recovery": "choose_roles"})
    if len(set(role_ids)) != len(role_ids):
        raise HTTPException(409, {"code": "role_already_taken", "message": "每个角色只能由一个席位选择。", "details": {}, "recovery": "choose_roles"})
    if not all(seat.get("ready") for seat in room["seats"]):
        raise HTTPException(409, {"code": "seats_not_ready", "message": "还有同行者没有准备好。", "details": {}, "recovery": "wait_for_seats"})
    session_id = f"game-{uuid4().hex[:10]}"
    player_ids = [seat["player_id"] for seat in room["seats"]]
    player_configs = [{"player_id": seat["player_id"], "name": seat["name"], "role_id": seat["role_id"], "start_site_id": content.roles[seat["role_id"]].get("start_site_id", "yungang")} for seat in room["seats"]]
    state = engine.new_game(session_id, player_ids, room["difficulty_id"], room["scenario_id"], room.get("seed"), player_configs=player_configs, solo_mode=room["play_mode"] == "solo")
    room["session_id"] = session_id
    room["status"] = "in_progress"
    room["updated_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    room_service.repository.save(room)
    repo.save(state)
    return {"room": room_service.public(room, x_seat_token), "session_id": session_id}


@app.get("/api/rooms/{room_id}/events-ticket")
def room_events_ticket(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        ticket = room_service.issue_event_ticket(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"ticket": ticket, "expires_in": 60}


@app.get("/api/rooms/{room_id}/game", response_model=GameState)
def room_game(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        seat = room_service.authenticate(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    if not room.get("session_id"):
        raise HTTPException(409, {"code": "room_not_started", "message": "旅程还没有点亮。", "details": {}, "recovery": "return_to_room"})
    state = repo.get(room["session_id"])
    if not state:
        raise HTTPException(404, {"code": "session_not_found", "message": "找不到这段旅程。", "details": {}, "recovery": "return_home"})
    state = GameState.model_validate(state.model_dump())
    controlled_ids = [item["player_id"] for item in room["seats"]] if room["play_mode"] in {"solo", "local"} else [seat["player_id"]]
    can_act = room["status"] == "in_progress" and state.shared.active_player_id in controlled_ids
    state.viewer = {"seat_id": seat["seat_id"], "player_id": seat["player_id"], "controlled_player_ids": controlled_ids, "can_act": can_act, "can_manage_room": seat["seat_id"] == "seat-1", "play_mode": room["play_mode"], "paused": room["status"] == "paused", "room_id": room["room_id"], "room_status": room["status"], "seats": [{key: item.get(key) for key in ("seat_id", "player_id", "name", "role_id", "ready", "connected")} for item in room["seats"]]}
    if not can_act:
        state.legal_actions = []
        state.action_options = []
        state.pending_choice = None
    return state


async def _room_revision_stream(room_id: str):
    last_signature = None
    for _ in range(90):
        room = room_service.repository.get(room_id)
        if not room:
            break
        state = repo.get(room.get("session_id")) if room.get("session_id") else None
        signature = (room.get("updated_at"), state.revision if state else None, room.get("status"))
        if signature != last_signature:
            yield f"event: revision\ndata: {json.dumps({'revision': state.revision if state else None, 'status': room.get('status')}, ensure_ascii=False)}\n\n"
            last_signature = signature
        await asyncio.sleep(1)
    yield "event: close\ndata: {}\n\n"


@app.get("/api/rooms/{room_id}/events", include_in_schema=False)
async def room_events(room_id: str, ticket: str | None = None):
    room = _room_or_404(room_id)
    try:
        room_service.consume_event_ticket(room_id, ticket or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return StreamingResponse(_room_revision_stream(room_id), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@app.post("/api/rooms/{room_id}/actions", response_model=GameState)
def room_action(room_id: str, request: RoomActionRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        seat = room_service.authenticate(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    if room["status"] == "paused":
        raise HTTPException(409, {"code": "room_paused", "message": "旅舍暂时歇息中，等待房主重新点亮。", "details": {}, "recovery": "wait_for_host"})
    if not room.get("session_id"):
        raise HTTPException(409, {"code": "room_not_started", "message": "旅程还没有点亮。", "details": {}, "recovery": "return_to_room"})
    current = repo.get(room["session_id"])
    if not current:
        raise HTTPException(404, {"code": "session_not_found", "message": "找不到这段旅程。", "details": {}, "recovery": "return_home"})
    controlled_ids = {item["player_id"] for item in room["seats"]} if room["play_mode"] in {"solo", "local"} else {seat["player_id"]}
    if current.shared.active_player_id not in controlled_ids:
        raise HTTPException(403, {"code": "not_active_player", "message": "当前由另一位同行者行动。", "details": {}, "recovery": "wait_for_active_player"})
    player_id = current.shared.active_player_id
    legacy = ActionRequest(player_id=player_id, **request.model_dump())
    result = _run_action(room["session_id"], legacy)
    if result.shared.outcome:
        room["status"] = "completed"
        room_service.repository.save(room)
    return result

frontend_root = Path(__file__).resolve().parents[1] / "frontend"
frontend = frontend_root / "dist" if (frontend_root / "dist").exists() else frontend_root
ui_assets = frontend_root / "static" / "ui-assets"

@app.get("/game/{session_id}", include_in_schema=False)
def game_shell(session_id: str):
    return FileResponse(frontend / "index.html")

@app.get("/ui-assets/{asset_name:path}", include_in_schema=False)
def ui_asset(asset_name: str):
    root = ui_assets.resolve()
    asset = (root / asset_name).resolve()
    if root not in asset.parents and asset != root:
        raise HTTPException(404, "asset not found")
    if not asset.is_file():
        asset = (root / "generated" / asset_name).resolve()
    if root not in asset.parents or not asset.is_file():
        raise HTTPException(404, "asset not found")
    return FileResponse(asset)

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: dict) -> Response:
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
        return response

app.mount("/", SPAStaticFiles(directory=frontend, html=True), name="frontend")

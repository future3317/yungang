import asyncio
import json
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from backend.actions import dispatch
from backend.dependencies import content, engine, repo, room_service
from backend.errors import error_detail, error_status
from backend.models import (
    ActionRequest,
    GameState,
    GameStateResponse,
    RoomActionRequest,
    RoomCreateRequest,
    RoomCredentials,
    RoomEventTicket,
    RoomJoinRequest,
    RoomPublic,
    RoomReadyRequest,
    RoomReconnectRequest,
    RoomRoleRequest,
    RoomSeatUpdateRequest,
    RoomStartResponse,
    ViewerState,
)

router = APIRouter()


def _public_state_payload(state: GameState | None) -> dict | None:
    """Keep conflict recovery responses on the same public DTO boundary as 200 responses."""
    return GameStateResponse.model_validate(state.model_dump()).model_dump(mode="json") if state is not None else None


def _room_or_404(room_id: str) -> dict:
    room = room_service.repository.get(room_id)
    if not room:
        raise HTTPException(404, {"code": "room_not_found", "message": "找不到这间旅舍。", "details": {"room_id": room_id}, "recovery": "return_home"})
    return room


def _room_token_error(exc: ValueError) -> HTTPException:
    code = str(exc)
    return HTTPException(error_status(code), error_detail(content.terminology, code, default_recovery="return_to_room"))


def _require_host(room: dict, token: str | None) -> None:
    try:
        seat = room_service.authenticate(room, token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    if seat["seat_id"] != "seat-1":
        raise HTTPException(403, {"code": "host_required", "message": "只有房主可以改变旅舍状态。", "details": {}, "recovery": "wait_for_host"})


def _run_action(session_id: str, request: ActionRequest, state: GameState | None = None) -> GameState:
    state = state or repo.get(session_id)
    if not state:
        raise HTTPException(404, {"code": "session_not_found", "message": "找不到这段旅程。", "details": {"session_id": session_id}, "recovery": "return_home"})
    if request.request_id and request.request_id in state.processed_request_ids:
        return state
    if request.expected_revision != state.revision:
        raise HTTPException(status_code=409, detail={"code": "revision_conflict", "message": "旅程状态已更新，请同步后重新选择行动。", "details": {"expected_revision": request.expected_revision, "actual_revision": state.revision}, "recovery": "sync_current_state", "current_state": _public_state_payload(state)})
    expected_revision = request.expected_revision
    try:
        state = dispatch(engine, state, request)
    except ValueError as exc:
        code = str(exc)
        raise HTTPException(400, error_detail(content.terminology, code)) from exc
    if not repo.save_if_revision(state, expected_revision):
        current = repo.get(session_id)
        raise HTTPException(status_code=409, detail={"code": "revision_conflict", "current_state": _public_state_payload(current)})
    return state


async def _room_revision_stream(room_id: str, listener):
    try:
        deadline = asyncio.get_running_loop().time() + 90
        while True:
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                break
            try:
                event = await asyncio.wait_for(listener[1].get(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            yield f"event: revision\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
            if event.get("status") in {"completed", "abandoned"}:
                break
    finally:
        room_service.repository.unsubscribe(room_id, listener)
    yield "event: close\ndata: {}\n\n"


@router.post("/api/rooms", response_model=RoomCredentials)
def create_room(request: RoomCreateRequest):
    archive_id = request.archive_id
    archived_state = None
    if archive_id:
        archived_state = repo.get(archive_id)
        if not archived_state:
            rooms_by_session = room_service.rooms_by_session()
            room = rooms_by_session.get(archive_id)
            if room:
                archived_state = repo.get(room.get("session_id"))
        if not archived_state:
            raise HTTPException(404, {"code": "archive_not_found", "message": "找不到指定的存档。", "details": {"archive_id": archive_id}, "recovery": "return_home"})
    room, host_token, seat_token = room_service.create(f"room-{uuid4().hex[:16]}", request)
    if archived_state:
        room["session_id"] = archived_state.session_id
        room["status"] = "in_progress"
        room["scenario_id"] = archived_state.scenario_id
        room["difficulty_id"] = archived_state.difficulty_id
        room["updated_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        room_service.repository.save(room)
    return {"room": room_service.public(room, seat_token), "host_token": host_token, "seat_token": seat_token, "session_id": room.get("session_id")}


@router.get("/api/rooms/{room_id}", response_model=RoomPublic)
def get_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/join", response_model=RoomCredentials)
def join_room(room_id: str, request: RoomJoinRequest):
    room = _room_or_404(room_id)
    try:
        room, seat_token, _ = room_service.join(room, request.name, request.role_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"room": room_service.public(room, seat_token), "seat_token": seat_token}


@router.post("/api/rooms/{room_id}/reconnect", response_model=RoomCredentials)
def reconnect_room(room_id: str, request: RoomReconnectRequest):
    room = _room_or_404(room_id)
    try:
        room, seat_token = room_service.reconnect(room, request.seat_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"room": room_service.public(room, seat_token), "seat_token": seat_token}


@router.post("/api/rooms/{room_id}/ready", response_model=RoomPublic)
def ready_room(room_id: str, request: RoomReadyRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        room_service.set_ready(room, x_seat_token or "", request.ready)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/role", response_model=RoomPublic)
def role_room(room_id: str, request: RoomRoleRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    if request.role_id not in content.roles:
        raise HTTPException(400, {"code": "unknown_role", "message": "找不到这个角色。", "details": {}, "recovery": "choose_another_role"})
    try:
        room_service.set_role(room, x_seat_token or "", request.role_id)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/seats/{seat_id}", response_model=RoomPublic)
def update_local_seat(room_id: str, seat_id: str, request: RoomSeatUpdateRequest, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    if request.role_id is not None and request.role_id not in content.roles:
        raise HTTPException(400, {"code": "unknown_role", "message": "找不到这个角色。", "details": {}, "recovery": "choose_another_role"})
    try:
        room_service.update_local_seat(room, x_seat_token or "", seat_id, request.name, request.role_id, request.ready)
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/leave", response_model=RoomPublic)
def leave_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        room_service.leave(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/pause", response_model=RoomPublic)
def pause_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    _require_host(room, x_seat_token)
    if room["status"] == "in_progress":
        room["status"] = "paused"
        room_service.repository.save(room)
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/resume", response_model=RoomPublic)
def resume_room(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    _require_host(room, x_seat_token)
    if room["status"] == "paused":
        room["status"] = "in_progress"
        room_service.repository.save(room)
    return room_service.public(room, x_seat_token)


@router.post("/api/rooms/{room_id}/start", response_model=RoomStartResponse)
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


@router.get("/api/rooms/{room_id}/events-ticket", response_model=RoomEventTicket)
def room_events_ticket(room_id: str, x_seat_token: str | None = Header(default=None)):
    room = _room_or_404(room_id)
    try:
        ticket = room_service.issue_event_ticket(room, x_seat_token or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    return {"ticket": ticket, "expires_in": 60}


@router.get("/api/rooms/{room_id}/game", response_model=GameStateResponse)
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
    state.viewer = ViewerState(
        seat_id=seat["seat_id"],
        player_id=seat["player_id"],
        controlled_player_ids=controlled_ids,
        can_act=can_act,
        can_manage_room=seat["seat_id"] == "seat-1",
        play_mode=room["play_mode"],
        paused=room["status"] == "paused",
        room_id=room["room_id"],
        room_status=room["status"],
        seats=[{key: item.get(key) for key in ("seat_id", "player_id", "name", "role_id", "ready", "connected")} for item in room["seats"]],
    )
    if not can_act:
        state.action_options = []
        state.pending_choice = None
    return state


@router.get("/api/rooms/{room_id}/events", include_in_schema=False)
async def room_events(room_id: str, ticket: str | None = None):
    room = _room_or_404(room_id)
    try:
        room_service.consume_event_ticket(room_id, ticket or "")
    except ValueError as exc:
        raise _room_token_error(exc) from exc
    listener = room_service.repository.subscribe(room_id)
    if room.get("status") in {"completed", "abandoned"}:
        room_service.repository.notify(room_id, room=room)
    return StreamingResponse(_room_revision_stream(room_id, listener), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@router.post("/api/rooms/{room_id}/actions", response_model=GameStateResponse)
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
    action_request = ActionRequest(player_id=player_id, **request.model_dump())
    result = _run_action(room["session_id"], action_request, current)
    if result.shared.outcome:
        room["status"] = "completed"
        room_service.repository.save(room, revision=result.revision)
    else:
        room_service.repository.notify(room_id, revision=result.revision, room=room)
    return result

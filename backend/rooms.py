"""Token-backed room and seat lifecycle for local and multi-device play."""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .database import Database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token() -> str:
    return secrets.token_urlsafe(32)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RoomRepository:
    def __init__(self, path: str | Path | Database):
        self.database = path if isinstance(path, Database) else Database(path)
        self.path = self.database.path
        self._listeners: dict[str, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]]] = {}
        self._listener_lock = threading.Lock()
        self.database.ensure_rooms()

    def get(self, room_id: str) -> Optional[dict[str, Any]]:
        with self.database.connect() as db:
            row = db.execute(self.database.sql("SELECT payload FROM rooms WHERE room_id=?"), (room_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def save(self, room: dict[str, Any], revision: int | None = None) -> None:
        payload = json.dumps(room, ensure_ascii=False, separators=(",", ":"))
        with self.database.connect() as db:
            db.execute(self.database.sql("INSERT INTO rooms(room_id,session_id,payload) VALUES(?,?,?) ON CONFLICT(room_id) DO UPDATE SET session_id=excluded.session_id,payload=excluded.payload"), (room["room_id"], room.get("session_id"), payload))
        self.notify(room["room_id"], revision=revision, room=room)

    def subscribe(self, room_id: str) -> tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]:
        listener = (asyncio.get_running_loop(), asyncio.Queue(maxsize=8))
        with self._listener_lock:
            self._listeners.setdefault(room_id, set()).add(listener)
        return listener

    def unsubscribe(self, room_id: str, listener: tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, Any]]]) -> None:
        with self._listener_lock:
            listeners = self._listeners.get(room_id)
            if not listeners:
                return
            listeners.discard(listener)
            if not listeners:
                self._listeners.pop(room_id, None)

    def notify(self, room_id: str, *, revision: int | None = None, room: dict[str, Any] | None = None) -> None:
        if room is None:
            room = self.get(room_id)
        if not room:
            return
        event = {"revision": revision, "status": room.get("status"), "updated_at": room.get("updated_at")}
        with self._listener_lock:
            listeners = tuple(self._listeners.get(room_id, ()))
        for loop, queue in listeners:
            def enqueue(queue=queue, event=event):
                if queue.full():
                    queue.get_nowait()
                queue.put_nowait(event)
            loop.call_soon_threadsafe(enqueue)


class RoomService:
    def __init__(self, repository: RoomRepository):
        self.repository = repository
        self._event_tickets: dict[str, tuple[str, float]] = {}

    def create(self, room_id: str, request: Any) -> tuple[dict[str, Any], str, str]:
        host_token = _token()
        seat_token = _token()
        mode = request.play_mode if request.play_mode in {"solo", "local", "multi_device"} else "solo"
        seats = [self._seat("seat-1", request.name, request.role_id, seat_token, True)]
        if mode in {"solo", "local"}:
            for index in range(2, (2 if mode == "solo" else request.max_players) + 1):
                name = "协作角色" if mode == "solo" else f"本地同行者 {index}"
                seats.append(self._seat(f"seat-{index}", name, None, _token(), True))
        room = {
            "room_id": room_id,
            "status": "lobby",
            "play_mode": mode,
            "scenario_id": request.scenario_id,
            "difficulty_id": request.difficulty_id,
            "seed": request.seed,
            "max_players": 2 if mode == "solo" else max(2, request.max_players) if mode == "local" else request.max_players,
            "host_token_hash": _digest(host_token),
            "session_id": None,
            "created_at": _now(),
            "updated_at": _now(),
            "seats": seats,
        }
        self.repository.save(room)
        return room, host_token, seat_token

    def join(self, room: dict[str, Any], name: str, role_id: Optional[str]) -> tuple[dict[str, Any], str, dict[str, Any]]:
        if room["status"] != "lobby":
            raise ValueError("room_not_joinable")
        if len(room["seats"]) >= room["max_players"]:
            raise ValueError("room_full")
        used_roles = {seat.get("role_id") for seat in room["seats"]}
        seat_number = len(room["seats"]) + 1
        seat_token = _token()
        seat = self._seat(f"seat-{seat_number}", name, role_id, seat_token, False)
        seat["role_locked"] = bool(role_id and role_id not in used_roles)
        room["seats"].append(seat)
        room["updated_at"] = _now()
        self.repository.save(room)
        return room, seat_token, seat

    def reconnect(self, room: dict[str, Any], seat_id: str) -> tuple[dict[str, Any], str]:
        if room["status"] == "lobby":
            raise ValueError("room_not_started")
        seat = next((item for item in room["seats"] if item["seat_id"] == seat_id), None)
        if not seat:
            raise ValueError("seat_not_found")
        seat_token = _token()
        seat["token_hash"] = _digest(seat_token)
        seat["connected"] = True
        room["updated_at"] = _now()
        self.repository.save(room)
        return room, seat_token

    def authenticate(self, room: dict[str, Any], token: Optional[str]) -> dict[str, Any]:
        if not token:
            raise ValueError("seat_token_required")
        token_hash = _digest(token)
        for seat in room["seats"]:
            if secrets.compare_digest(seat["token_hash"], token_hash):
                return seat
        if secrets.compare_digest(room["host_token_hash"], token_hash):
            return room["seats"][0]
        raise ValueError("invalid_seat_token")

    def issue_event_ticket(self, room: dict[str, Any], seat_token: str) -> str:
        self.authenticate(room, seat_token)
        ticket = _token()
        self._event_tickets[_digest(ticket)] = (room["room_id"], time.monotonic() + 60)
        return ticket

    def consume_event_ticket(self, room_id: str, ticket: str) -> None:
        if not ticket:
            raise ValueError("seat_token_required")
        record = self._event_tickets.pop(_digest(ticket), None)
        if not record or record[0] != room_id or record[1] < time.monotonic():
            raise ValueError("invalid_seat_token")

    def set_ready(self, room: dict[str, Any], token: str, ready: bool) -> dict[str, Any]:
        seat = self.authenticate(room, token)
        seat["ready"] = ready
        room["updated_at"] = _now()
        self.repository.save(room)
        return room

    def update_local_seat(self, room: dict[str, Any], token: str, seat_id: str, name: Optional[str], role_id: Optional[str], ready: Optional[bool]) -> dict[str, Any]:
        host = self.authenticate(room, token)
        if host["seat_id"] != "seat-1":
            raise ValueError("host_required")
        if room["play_mode"] == "multi_device" and seat_id != "seat-1":
            raise ValueError("host_required")
        seat = next((item for item in room["seats"] if item["seat_id"] == seat_id), None)
        if not seat:
            raise ValueError("seat_not_found")
        if role_id is not None:
            if any(item is not seat and item.get("role_id") == role_id for item in room["seats"]):
                raise ValueError("role_already_taken")
            seat["role_id"] = role_id
            seat["ready"] = False
        if name is not None:
            seat["name"] = name.strip()[:24] or "同行者"
        if ready is not None:
            if ready and not seat.get("role_id"):
                raise ValueError("role_required")
            seat["ready"] = ready
        room["updated_at"] = _now()
        self.repository.save(room)
        return room

    def set_role(self, room: dict[str, Any], token: str, role_id: str) -> dict[str, Any]:
        seat = self.authenticate(room, token)
        if any(other is not seat and other.get("role_id") == role_id for other in room["seats"]):
            raise ValueError("role_already_taken")
        seat["role_id"] = role_id
        room["updated_at"] = _now()
        self.repository.save(room)
        return room

    def leave(self, room: dict[str, Any], token: str) -> dict[str, Any]:
        seat = self.authenticate(room, token)
        if room["status"] != "lobby":
            raise ValueError("room_already_started")
        if seat["seat_id"] == "seat-1":
            room["status"] = "abandoned"
        else:
            room["seats"] = [item for item in room["seats"] if item["seat_id"] != seat["seat_id"]]
        room["updated_at"] = _now()
        self.repository.save(room)
        return room

    def public(self, room: dict[str, Any], token: Optional[str] = None) -> dict[str, Any]:
        viewer = None
        if token:
            try:
                viewer = self.authenticate(room, token)["seat_id"]
            except ValueError:
                viewer = None
        return {
            "room_id": room["room_id"],
            "status": room["status"],
            "play_mode": room["play_mode"],
            "scenario_id": room["scenario_id"],
            "difficulty_id": room["difficulty_id"],
            "max_players": room["max_players"],
            "created_at": room["created_at"],
            "updated_at": room["updated_at"],
            "viewer_seat_id": viewer,
            "seats": [{key: seat.get(key) for key in ("seat_id", "name", "role_id", "ready", "connected", "role_locked")} for seat in room["seats"]],
        }

    def room_for_session(self, session_id: str) -> Optional[dict[str, Any]]:
        with self.repository.database.connect() as db:
            row = db.execute(self.repository.database.sql("SELECT payload FROM rooms WHERE session_id=? LIMIT 1"), (session_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def rooms_by_session(self) -> dict[str, dict[str, Any]]:
        with self.repository.database.connect() as db:
            rows = db.execute(self.repository.database.sql("SELECT session_id, payload FROM rooms WHERE session_id IS NOT NULL")).fetchall()
        result: dict[str, dict[str, Any]] = {}
        for session_id, payload in rows:
            try:
                result[str(session_id)] = json.loads(payload)
            except (TypeError, json.JSONDecodeError):
                continue
        return result

    @staticmethod
    def _seat(seat_id: str, name: str, role_id: Optional[str], token: str, connected: bool) -> dict[str, Any]:
        return {"seat_id": seat_id, "player_id": f"player-{seat_id}", "name": name.strip()[:24] or "同行者", "role_id": role_id, "ready": False, "connected": connected, "role_locked": False, "token_hash": _digest(token)}

"""Token-backed room and seat lifecycle for local and multi-device play."""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token() -> str:
    return secrets.token_urlsafe(32)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RoomRepository:
    def __init__(self, path: Path):
        self.path = Path(path)
        with sqlite3.connect(self.path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS rooms (room_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")

    def get(self, room_id: str) -> Optional[dict[str, Any]]:
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT payload FROM rooms WHERE room_id=?", (room_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def save(self, room: dict[str, Any]) -> None:
        payload = json.dumps(room, ensure_ascii=False, separators=(",", ":"))
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT INTO rooms(room_id,payload) VALUES(?,?) ON CONFLICT(room_id) DO UPDATE SET payload=excluded.payload", (room["room_id"], payload))


class RoomService:
    def __init__(self, repository: RoomRepository):
        self.repository = repository

    def create(self, room_id: str, request: Any) -> tuple[dict[str, Any], str, str]:
        host_token = _token()
        seat_token = _token()
        mode = request.play_mode if request.play_mode in {"solo", "local", "multi_device"} else "solo"
        room = {
            "room_id": room_id,
            "status": "lobby",
            "play_mode": mode,
            "scenario_id": request.scenario_id,
            "difficulty_id": request.difficulty_id,
            "seed": request.seed,
            "max_players": 2 if mode == "solo" else request.max_players,
            "host_token_hash": _digest(host_token),
            "session_id": None,
            "created_at": _now(),
            "updated_at": _now(),
            "seats": [self._seat("seat-1", request.name, request.role_id, seat_token, True)],
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

    def set_ready(self, room: dict[str, Any], token: str, ready: bool) -> dict[str, Any]:
        seat = self.authenticate(room, token)
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
            "session_id": room.get("session_id"),
            "created_at": room["created_at"],
            "updated_at": room["updated_at"],
            "viewer_seat_id": viewer,
            "seats": [{key: seat.get(key) for key in ("seat_id", "name", "role_id", "ready", "connected", "role_locked")} for seat in room["seats"]],
        }

    @staticmethod
    def _seat(seat_id: str, name: str, role_id: Optional[str], token: str, connected: bool) -> dict[str, Any]:
        return {"seat_id": seat_id, "player_id": f"player-{seat_id}", "name": name.strip()[:24] or "同行者", "role_id": role_id, "ready": False, "connected": connected, "role_locked": False, "token_hash": _digest(token)}

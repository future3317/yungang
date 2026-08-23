from pathlib import Path

from backend.content import Content
from backend.database import database_target_from_environment
from backend.engine import GameEngine
from backend.repository import GameRepository
from backend.rooms import RoomRepository, RoomService

repo = GameRepository(database_target_from_environment())
content = Content()
engine = GameEngine(content)
room_service = RoomService(RoomRepository(repo.database))


def reconfigure(database_path: str | Path) -> None:
    """Point the runtime repository at an isolated database (used by tests)."""
    global repo, room_service
    isolated = GameRepository(database_path)
    repo.database = isolated.database
    repo.path = isolated.path
    room_service = RoomService(RoomRepository(repo.database))

import json

from fastapi import APIRouter

from backend.dependencies import repo, room_service
from backend.models import ArchiveSummary
from backend.repository import migrate_game_state

router = APIRouter()


@router.get("/api/archives", response_model=list[ArchiveSummary])
def list_archives() -> list[ArchiveSummary]:
    rooms = room_service.rooms_by_session()
    archives: list[ArchiveSummary] = []
    for session_id, raw_state in repo.list_raw():
        try:
            state = migrate_game_state(json.loads(raw_state))
        except (TypeError, json.JSONDecodeError, ValueError):
            continue
        from backend.models import GameState

        state = GameState.model_validate(state)
        room = rooms.get(session_id)
        journal = state.shared.journal or []
        timestamps = [entry.created_at for entry in journal if entry.created_at]
        updated_at = max(timestamps) if timestamps else None
        status = str(room.get("status")) if room else ("completed" if state.shared.outcome else "in_progress")
        archives.append(ArchiveSummary(
            archive_id=str(room.get("room_id")) if room else session_id,
            session_id=session_id,
            room_id=str(room.get("room_id")) if room else None,
            mode=str(room.get("play_mode")) if room else "solo",
            status=status,
            scenario_id=state.scenario_id or state.shared.scenario_id,
            difficulty_id=state.difficulty_id,
            turn=state.shared.turn,
            max_rounds=state.shared.max_rounds,
            updated_at=updated_at,
            outcome=state.shared.outcome,
            players=[{"name": player.name, "role_id": player.role_id} for player in state.players.values()],
        ))
    return sorted(archives, key=lambda item: item.updated_at or "", reverse=True)

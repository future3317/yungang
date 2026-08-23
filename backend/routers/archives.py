import json

from fastapi import APIRouter, Header, HTTPException

from backend.dependencies import repo, room_service
from backend.models import ArchiveSummary

router = APIRouter()


@router.get("/api/archives", response_model=list[ArchiveSummary])
def list_archives(x_archive_capabilities: str | None = Header(default=None)) -> list[ArchiveSummary]:
    if not x_archive_capabilities:
        raise HTTPException(401, {"code": "archive_capability_required", "message": "请从本机历史记录进入，或提供存档恢复凭证。", "details": {}, "recovery": "choose_saved_archive"})
    try:
        capabilities = json.loads(x_archive_capabilities)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, {"code": "invalid_archive_capability", "message": "存档恢复凭证格式不正确。", "details": {}, "recovery": "choose_saved_archive"}) from exc
    if not isinstance(capabilities, dict):
        raise HTTPException(400, {"code": "invalid_archive_capability", "message": "存档恢复凭证格式不正确。", "details": {}, "recovery": "choose_saved_archive"})
    archives: list[ArchiveSummary] = []
    for room_id, recovery_token in capabilities.items():
        room = room_service.repository.get(str(room_id))
        if not room or not isinstance(recovery_token, str):
            continue
        try:
            room_service.verify_recovery(room, recovery_token)
        except ValueError:
            continue
        session_id = room.get("session_id")
        if not session_id:
            continue
        state = repo.get(session_id)
        if not state:
            continue
        journal = state.shared.journal or []
        timestamps = [entry.created_at for entry in journal if entry.created_at]
        updated_at = max(timestamps) if timestamps else None
        status = str(room.get("status")) if room else ("completed" if state.shared.outcome else "in_progress")
        archives.append(ArchiveSummary(
            archive_id=str(room_id),
            room_id=str(room_id),
            mode=str(room.get("play_mode")),
            status=str(room.get("status")),
            scenario_id=state.scenario_id or state.shared.scenario_id,
            difficulty_id=state.difficulty_id,
            turn=state.shared.turn,
            max_rounds=state.shared.max_rounds,
            updated_at=updated_at,
            outcome=state.shared.outcome,
            players=[{"name": player.name, "role_id": player.role_id} for player in state.players.values()],
        ))
    return sorted(archives, key=lambda item: item.updated_at or "", reverse=True)

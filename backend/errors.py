from __future__ import annotations

from typing import Any


RECOVERY_BY_CODE = {
    "not_active_player": "wait_for_active_player",
    "invalid_route": "choose_another_action",
    "site_does_not_need_restoration": "inspect_site_status",
    "planning_not_active": "continue_current_phase",
    "game_is_over": "open_result",
    "seat_token_required": "return_to_room",
    "invalid_seat_token": "reconnect_seat",
    "room_not_joinable": "return_to_room",
    "room_not_started": "wait_for_host",
    "room_full": "return_home",
    "seat_not_found": "choose_seat",
    "role_already_taken": "choose_another_role",
    "room_already_started": "return_to_room",
}


def error_detail(terminology: dict[str, Any], code: str, *, default_recovery: str = "choose_another_action") -> dict[str, Any]:
    base_code = code.split(":", 1)[0]
    catalog = terminology.get("errors", {})
    entry = catalog.get(base_code) if isinstance(catalog, dict) else None
    if isinstance(entry, dict):
        message = str(entry.get("message") or "操作暂时无法完成，请重新选择。")
        recovery = str(entry.get("recovery") or RECOVERY_BY_CODE.get(base_code, default_recovery))
    else:
        message = str(entry) if isinstance(entry, str) else "操作暂时无法完成，请重新选择。"
        recovery = RECOVERY_BY_CODE.get(base_code, default_recovery)
    return {"code": code, "message": message, "details": {}, "recovery": recovery}


def error_status(code: str) -> int:
    return 401 if code in {"seat_token_required", "invalid_seat_token"} else 400

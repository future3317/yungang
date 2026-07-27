from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from .actions import dispatch
from .content import Content
from .engine import GameEngine
from .models import ActionRequest, CreateGameRequest, JoinGameRequest
from .repository import GameRepository

app = FastAPI(title="Yungang Heritage Network", version="3.0")
repo = GameRepository()
content = Content()
engine = GameEngine(content)

@app.get("/api/meta")
def meta():
    return {"schema_version": 3, "mode": "heritage_network", "domains": content.domains, "domain_meta": content.domain_meta, "terminology": content.terminology, "regions": content.regions, "scenarios": list(content.scenarios.values()), "roles": list(content.roles.values()), "sites": list(content.sites.values()), "facets": content.site_facets, "cards": list(content.cards.values()), "action_cards": list(content.action_cards.values()), "events": list(content.events.values()), "tasks": list(content.tasks.values()), "projects": list(content.projects.values()), "objectives": list(content.objectives.values()), "difficulty": list(content.difficulty.values())}

@app.post("/api/games")
def create_game(request: CreateGameRequest):
    session_id = f"game-{uuid4().hex[:10]}"
    seed = request.seed if request.seed is not None else request.daily_seed
    state = engine.new_game(session_id, request.player_ids, request.difficulty_id, request.scenario_id, seed)
    repo.save(state)
    return state

@app.post("/api/games/{session_id}")
def create_game_with_id(session_id: str, request: CreateGameRequest):
    """Stable local-session creation endpoint used by demos, tests, and recovery flows."""
    seed = request.seed if request.seed is not None else request.daily_seed
    state = engine.new_game(session_id, request.player_ids, request.difficulty_id, request.scenario_id, seed)
    repo.save(state)
    return state

@app.post("/api/games/{session_id}/players")
def join_game(session_id: str, request: JoinGameRequest):
    state = repo.get(session_id)
    if not state: raise HTTPException(404, "game not found")
    if state.revision or len(state.players) >= 4: raise HTTPException(409, "game has already started")
    if request.player_id in state.players: return state
    role_id = request.role_id or next(role for role in content.roles if role not in {player.role_id for player in state.players.values()})
    role = content.roles.get(role_id)
    if not role: raise HTTPException(400, "unknown role")
    state.players[request.player_id] = engine.new_game("role-preview", [request.player_id, "p2"]).players[request.player_id]
    state.players[request.player_id].role_id = role_id
    state.players[request.player_id].name = role["name"]
    state.players[request.player_id].location = role.get("start_site_id", "yungang")
    state.shared.player_order.append(request.player_id)
    repo.save(state)
    return engine.refresh(state)

@app.get("/api/games/{session_id}")
def get_game(session_id: str):
    state = repo.get(session_id)
    if not state: raise HTTPException(404, "game not found")
    return state

@app.post("/api/games/{session_id}/actions")
def game_action(session_id: str, request: ActionRequest):
    state = repo.get(session_id)
    if not state: raise HTTPException(404, "game not found")
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
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response

app.mount("/", SPAStaticFiles(directory=frontend, html=True), name="frontend")

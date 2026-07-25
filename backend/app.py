from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from .actions import dispatch
from .content import Content
from .engine import GameEngine
from .models import ActionRequest, CreateGameRequest, JoinGameRequest
from .repository import GameRepository

app = FastAPI(title="云冈遗产网络", version="2.0")
repo = GameRepository()
content = Content()
engine = GameEngine(content)

@app.get("/api/meta")
def meta():
    return {"schema_version":2,"mode":"heritage_network","domains":content.domains,"roles":list(content.roles.values()),"sites":list(content.sites.values()),"cards":list(content.cards.values()),"events":list(content.events.values()),"tasks":list(content.tasks.values()),"difficulty":list(content.difficulty.values())}

@app.post("/api/games")
def create_game(request: CreateGameRequest):
    session_id = f"game-{repo.next_id()}"
    state = engine.new_game(session_id, request.player_ids, request.difficulty_id)
    repo.save(state)
    return state

@app.post("/api/games/{session_id}")
def create_game_legacy(session_id: str, request: CreateGameRequest | None = None):
    request = request or CreateGameRequest()
    state = engine.new_game(session_id, request.player_ids, request.difficulty_id)
    repo.save(state)
    return state

@app.post("/api/games/{session_id}/players")
def join_game(session_id: str, request: JoinGameRequest):
    state = repo.get(session_id)
    if not state: raise HTTPException(404, "game not found")
    if state.revision or len(state.players) >= 4: raise HTTPException(409, "game has already started")
    if request.player_id in state.players: return state
    role_id = request.role_id or next(role for role in content.roles if role not in {p.role_id for p in state.players.values()})
    role = content.roles.get(role_id)
    if not role: raise HTTPException(400, "unknown role")
    state.players[request.player_id] = engine.new_game("role-preview", [request.player_id, "p2"]).players[request.player_id]
    state.players[request.player_id].role_id = role_id; state.players[request.player_id].name = role["name"]; state.players[request.player_id].location = role.get("start_site_id", "yungang")
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
        raise HTTPException(status_code=409, detail={"code":"revision_conflict", "current_state":state.model_dump()})
    try: state = dispatch(engine, state, request)
    except ValueError as exc: raise HTTPException(400, str(exc))
    repo.save(state)
    return state

frontend = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")

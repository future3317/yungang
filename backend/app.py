from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from .actions import dispatch
from .engine import GameEngine
from .models import ActionRequest
from .repository import GameRepository

app = FastAPI(title="云冈遗产网络", version="2.0")
repo = GameRepository()
engine = GameEngine()

@app.post("/api/games/{session_id}")
def create_game(session_id: str):
    state = engine.new_game(session_id)
    repo.save(state)
    return state

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
    try:
        state = dispatch(engine, state, request)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    repo.save(state)
    return state

frontend = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")

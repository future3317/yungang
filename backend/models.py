from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ActionRequest(BaseModel):
    player_id: str
    action: str
    expected_revision: int
    target_id: Optional[str] = None
    card_id: Optional[str] = None

class PlayerState(BaseModel):
    id: str
    name: str
    role_id: str
    location: str = "yungang"
    ap: int = 3
    max_ap: int = 3
    influence: int = 0
    durability: int = 3
    hand: List[str] = Field(default_factory=list)
    flags: Dict[str, Any] = Field(default_factory=dict)

class SiteState(BaseModel):
    id: str
    durability: int
    max_durability: int
    influence: int = 0
    discovered: bool = False
    domains: List[str] = Field(default_factory=list)

class SharedState(BaseModel):
    turn: int = 1
    active_player_id: str = "p1"
    season: int = 1
    threat: int = 0
    influence: int = 0
    victory: Optional[str] = None
    log: List[str] = Field(default_factory=list)

class GameState(BaseModel):
    schema_version: int = 2
    revision: int = 0
    session_id: str
    mode: str = "heritage_network"
    players: Dict[str, PlayerState]
    sites: Dict[str, SiteState]
    shared: SharedState = Field(default_factory=SharedState)
    decks: Dict[str, List[str]] = Field(default_factory=lambda: {"culture": [], "events": []})
    pending_choice: Optional[Dict[str, Any]] = None
    legal_actions: List[Dict[str, Any]] = Field(default_factory=list)

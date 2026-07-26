from enum import StrEnum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ActionType(StrEnum):
    MOVE = "move"
    EXPLORE = "explore"
    CONTRIBUTE = "contribute"
    RESTORE = "restore"
    EXCHANGE = "exchange"
    USE_SKILL = "use_skill"
    PLAY_CARD = "play_card"
    END_TURN = "end_turn"
    RESOLVE_EVENT = "resolve_event"
    SELECT_MARKET_CARD = "select_market_card"
    DISCARD = "discard"
    SURVEY_ROUTE = "survey_route"
    RESTORE_ROUTE = "restore_route"
    ESTABLISH_CONNECTION = "establish_connection"
    PREPARE = "prepare"
    SELECT_UPGRADE = "select_upgrade"
    PLAN = "plan"
    USE_ACTION_CARD = "use_action_card"

class SiteStatus(StrEnum):
    STABLE = "stable"
    AT_RISK = "at_risk"
    CLOSED = "closed"

class GameOutcome(StrEnum):
    VICTORY = "victory"
    DEFEAT = "defeat"

class ActionRequest(BaseModel):
    player_id: str
    action: ActionType
    expected_revision: int
    target_id: Optional[str] = None
    target_site_id: Optional[str] = None
    card_id: Optional[str] = None
    recipient_id: Optional[str] = None
    route_id: Optional[str] = None
    upgrade_id: Optional[str] = None

class CreateGameRequest(BaseModel):
    player_ids: List[str] = Field(default_factory=lambda: ["p1", "p2"])
    difficulty_id: str = "normal"
    scenario_id: str = "sand_and_stone"
    seed: Optional[int] = None
    daily_seed: Optional[str] = None

class JoinGameRequest(BaseModel):
    player_id: str
    role_id: Optional[str] = None

class PlayerState(BaseModel):
    id: str
    name: str
    role_id: str
    location: str
    ap: int = 3
    max_ap: int = 3
    influence: int = 0
    durability: int = 3
    hand: List[str] = Field(default_factory=list)
    action_hand: List[str] = Field(default_factory=list)
    flags: Dict[str, Any] = Field(default_factory=dict)
    skill_used: bool = False
    contributions: int = 0
    upgrades: List[str] = Field(default_factory=list)


class RouteState(BaseModel):
    id: str
    from_site: str
    to_site: str
    cost: int = 1
    status: str = "open"
    risk: int = 0
    connection_level: int = 0
    active_project_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class ProjectState(BaseModel):
    id: str
    site_id: str
    name: str
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    stage_index: int = 0
    progress: int = 0
    status: str = "active"
    contributors: List[str] = Field(default_factory=list)
    stage_evidence: List[Dict[str, Any]] = Field(default_factory=list)


class ObjectiveState(BaseModel):
    id: str
    name: str
    type: str
    target: int = 1
    progress: int = 0
    completed: bool = False


class ScoreState(BaseModel):
    tasks: int = 0
    routes: int = 0
    diversity: int = 0
    protection: int = 0
    resources: int = 0
    efficiency: int = 0
    discovery: int = 0
    total: int = 0

class SiteState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    id: str
    damage: int = 0
    max_damage: int = 3
    durability: int = 3
    max_durability: int = 3
    status: SiteStatus = SiteStatus.STABLE
    influence: int = 0
    discovered: bool = False
    domains: List[str] = Field(default_factory=list)
    contributions: List[Dict[str, Any]] = Field(default_factory=list)
    active_project_id: Optional[str] = None

class SharedState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    turn: int = 1
    max_rounds: int = 8
    active_player_id: str = "p1"
    player_order: List[str] = Field(default_factory=lambda: ["p1", "p2"])
    threat: int = 0
    influence: int = 0
    restoration_resource: int = 6
    completed_domains: List[str] = Field(default_factory=list)
    current_event_id: Optional[str] = None
    outcome: Optional[GameOutcome] = None
    outcome_reason: Optional[str] = None
    scenario_id: str = "sand_and_stone"
    research_clues: int = 0
    prepared_event_ids: List[str] = Field(default_factory=list)
    route_connection_score: int = 0
    log: List[str] = Field(default_factory=list)
    planning_marks: Dict[str, List[Dict[str, str]]] = Field(default_factory=dict)
    node_ability_uses: List[str] = Field(default_factory=list)

class GameState(BaseModel):
    schema_version: int = 3
    revision: int = 0
    session_id: str
    mode: str = "heritage_network"
    difficulty_id: str = "normal"
    players: Dict[str, PlayerState]
    sites: Dict[str, SiteState]
    tasks: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    shared: SharedState = Field(default_factory=SharedState)
    decks: Dict[str, List[str]] = Field(default_factory=lambda: {"culture": [], "events": []})
    market: List[str] = Field(default_factory=list)
    pending_choice: Optional[Dict[str, Any]] = None
    legal_actions: List[Dict[str, Any]] = Field(default_factory=list)
    action_options: List[Dict[str, Any]] = Field(default_factory=list)
    scenario_id: str = "sand_and_stone"
    seed: int = 0
    rng_state: int = 0
    rng_position: int = 0
    migrated_from_schema_version: Optional[int] = None
    routes: Dict[str, RouteState] = Field(default_factory=dict)
    projects: Dict[str, ProjectState] = Field(default_factory=dict)
    objectives: Dict[str, ObjectiveState] = Field(default_factory=dict)
    score: ScoreState = Field(default_factory=ScoreState)

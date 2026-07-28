from enum import StrEnum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ActionType(StrEnum):
    MOVE = "move"
    EXPLORE = "explore"
    CONTRIBUTE = "contribute"  # 内部项目阶段兼容值；玩家不再获得直接交付行动。
    INTERPRET_EVIDENCE = "interpret_evidence"
    FORM_INTERPRETATION = "form_interpretation"
    CHOOSE_INTERVENTION = "choose_intervention"
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
    USE_NODE_ABILITY = "use_node_ability"
    USE_UPGRADE = "use_upgrade"
    END_PLANNING = "end_planning"

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
    target_ids: Optional[List[str]] = None
    request_id: Optional[str] = None


class ActionTarget(BaseModel):
    id: str
    label: str
    preview_delta: Dict[str, Any] = Field(default_factory=dict)
    payload: Dict[str, Any] = Field(default_factory=dict)


class ActionOption(BaseModel):
    id: str
    type: str
    label: str
    description: str = ""
    cost: Dict[str, int] = Field(default_factory=lambda: {"ap": 0})
    enabled: bool = True
    disabled_reason: Optional[str] = None
    targets: List[ActionTarget] = Field(default_factory=list)
    preview_delta: Dict[str, Any] = Field(default_factory=dict)
    confirmation: str = ""
    payload: Dict[str, Any] = Field(default_factory=dict)

class CreateGameRequest(BaseModel):
    player_ids: List[str] = Field(default_factory=lambda: ["p1", "p2"])
    difficulty_id: str = "normal"
    scenario_id: str = "sand_and_stone"
    seed: Optional[int] = None
    daily_seed: Optional[str] = None


class RoomCreateRequest(BaseModel):
    play_mode: str = "solo"
    name: str = "同行者"
    role_id: Optional[str] = None
    scenario_id: str = "sand_and_stone"
    difficulty_id: str = "guided"
    seed: Optional[int] = None
    max_players: int = Field(default=4, ge=1, le=4)


class RoomJoinRequest(BaseModel):
    name: str = "同行者"
    role_id: Optional[str] = None


class RoomRoleRequest(BaseModel):
    role_id: str


class RoomReadyRequest(BaseModel):
    ready: bool = True


class RoomActionRequest(BaseModel):
    action: ActionType
    expected_revision: int
    target_id: Optional[str] = None
    target_site_id: Optional[str] = None
    card_id: Optional[str] = None
    recipient_id: Optional[str] = None
    route_id: Optional[str] = None
    upgrade_id: Optional[str] = None
    target_ids: Optional[List[str]] = None
    request_id: Optional[str] = None


class RoomSeatUpdateRequest(BaseModel):
    name: Optional[str] = None
    role_id: Optional[str] = None
    ready: Optional[bool] = None

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
    supplies: int = 0
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
    waypoints: List[List[float]] = Field(default_factory=list)
    road_class: str = "local"
    terrain: str = "plain"
    label_position: Optional[List[float]] = None
    name: Optional[str] = None
    strategic_role: Optional[str] = None
    risk_profile: Optional[str] = None
    ui_hint: Optional[str] = None
    event_tags: List[str] = Field(default_factory=list)


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
    completed_stages: List[str] = Field(default_factory=list)
    stage_progress: Dict[str, int] = Field(default_factory=dict)
    stage_contributors: Dict[str, List[str]] = Field(default_factory=dict)
    available_choices: List[Dict[str, Any]] = Field(default_factory=list)


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
    grade: str = "stone"

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
    phase: str = "player_action"
    weathering_track: int = 0
    weathering_limit: int = 5
    effective_rules: Dict[str, Any] = Field(default_factory=dict)
    solo_mode: bool = False
    controlled_character_ids: List[str] = Field(default_factory=list)
    journal: List[Dict[str, Any]] = Field(default_factory=list)
    event_targets: List[str] = Field(default_factory=list)
    event_instance: Dict[str, Any] = Field(default_factory=dict)
    event_history: List[Dict[str, Any]] = Field(default_factory=list)
    round_summary: Dict[str, Any] = Field(default_factory=dict)
    reserved_market_cards: List[str] = Field(default_factory=list)
    scenario_rule_uses: List[str] = Field(default_factory=list)

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
    action_options: List[ActionOption] = Field(default_factory=list)
    scenario_id: str = "sand_and_stone"
    seed: int = 0
    rng_state: int = 0
    rng_position: int = 0
    migrated_from_schema_version: Optional[int] = None
    routes: Dict[str, RouteState] = Field(default_factory=dict)
    projects: Dict[str, ProjectState] = Field(default_factory=dict)
    objectives: Dict[str, ObjectiveState] = Field(default_factory=dict)
    score: ScoreState = Field(default_factory=ScoreState)
    result: Dict[str, Any] = Field(default_factory=dict)
    viewer: Dict[str, Any] = Field(default_factory=dict)
    processed_request_ids: List[str] = Field(default_factory=list)

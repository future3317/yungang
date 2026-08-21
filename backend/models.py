from enum import StrEnum
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, JsonValue

JsonObject = Dict[str, JsonValue]

class ActionType(StrEnum):
    MOVE = "move"
    EXPLORE = "explore"
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


class FeedbackEvent(BaseModel):
    kind: str = "state_change"
    message: str
    changes: Dict[str, int] = Field(default_factory=dict)


class EventInstance(BaseModel):
    event_id: Optional[str] = None
    status: str = "forecast"
    forecast_scope: JsonObject = Field(default_factory=dict)
    revealed_targets: List[str] = Field(default_factory=list)
    resolved_targets: List[str] = Field(default_factory=list)
    mitigation: List[JsonObject] = Field(default_factory=list)
    resolution: List[JsonObject] = Field(default_factory=list)


class PendingChoice(BaseModel):
    kind: str
    options: List[JsonObject] = Field(default_factory=list)
    cards: List[str] = Field(default_factory=list)
    event_id: Optional[str] = None
    card_id: Optional[str] = None


class RoundSummary(BaseModel):
    round: int = 0
    event_id: Optional[str] = None
    event_targets: List[str] = Field(default_factory=list)
    event_resolution: List[JsonObject] = Field(default_factory=list)
    before: Dict[str, int] = Field(default_factory=dict)
    after: Dict[str, int] = Field(default_factory=dict)
    planning_mark_count: int = 0
    completed_projects: int = 0
    completed_objectives: int = 0
    player_contributions: Dict[str, int] = Field(default_factory=dict)


class GoalStatus(BaseModel):
    core_projects_completed: int = 0
    core_projects_target: int = 0
    objectives_completed: int = 0
    objectives_target: int = 0
    protected_sites: int = 0
    protected_sites_target: int = 0
    weathering: int = 0
    weathering_limit: int = 5
    rounds_remaining: int = 0


class ViewerState(BaseModel):
    seat_id: Optional[str] = None
    player_id: Optional[str] = None
    controlled_player_ids: List[str] = Field(default_factory=list)
    can_act: bool = False
    can_manage_room: bool = False
    play_mode: str = "solo"
    paused: bool = False
    room_id: Optional[str] = None
    room_status: Optional[str] = None
    seats: List[JsonObject] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: JsonObject = Field(default_factory=dict)
    recovery: Optional[str] = None


class MetaResponse(BaseModel):
    schema_version: int
    mode: str
    domains: List[str]
    domain_meta: Dict[str, JsonObject] = Field(default_factory=dict)
    terminology: JsonObject = Field(default_factory=dict)
    regions: List[JsonObject] = Field(default_factory=list)
    scenarios: List[JsonObject] = Field(default_factory=list)
    roles: List[JsonObject] = Field(default_factory=list)
    sites: List[JsonObject] = Field(default_factory=list)
    facets: List[JsonObject] = Field(default_factory=list)
    cards: List[JsonObject] = Field(default_factory=list)
    action_cards: List[JsonObject] = Field(default_factory=list)
    events: List[JsonObject] = Field(default_factory=list)
    tasks: List[JsonObject] = Field(default_factory=list)
    projects: List[JsonObject] = Field(default_factory=list)
    objectives: List[JsonObject] = Field(default_factory=list)
    difficulty: List[JsonObject] = Field(default_factory=list)


class RoomSeat(BaseModel):
    seat_id: str
    name: str
    role_id: Optional[str] = None
    ready: bool = False
    connected: bool = False
    role_locked: bool = False


class RoomPublic(BaseModel):
    room_id: str
    status: str
    play_mode: str
    scenario_id: str
    difficulty_id: str
    max_players: int
    created_at: str
    updated_at: str
    viewer_seat_id: Optional[str] = None
    seats: List[RoomSeat] = Field(default_factory=list)


class RoomCredentials(BaseModel):
    room: RoomPublic
    host_token: Optional[str] = None
    seat_token: str
    session_id: Optional[str] = None


class RoomStartResponse(BaseModel):
    room: RoomPublic
    session_id: str


class RoomEventTicket(BaseModel):
    ticket: str
    expires_in: int

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
    preview_delta: JsonObject = Field(default_factory=dict)
    payload: JsonObject = Field(default_factory=dict)


class ActionOption(BaseModel):
    id: str
    type: str
    label: str
    description: str = ""
    cost: Dict[str, int] = Field(default_factory=lambda: {"ap": 0})
    enabled: bool = True
    disabled_reason: Optional[str] = None
    targets: List[ActionTarget] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    recommendation_score: int = 0
    reason: str = ""
    preview_delta: JsonObject = Field(default_factory=dict)
    confirmation: str = ""
    payload: JsonObject = Field(default_factory=dict)

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


class RoomReconnectRequest(BaseModel):
    seat_id: str


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
    flags: JsonObject = Field(default_factory=dict)
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
    stages: List[JsonObject] = Field(default_factory=list)
    stage_index: int = 0
    progress: int = 0
    status: str = "active"
    contributors: List[str] = Field(default_factory=list)
    stage_evidence: List[JsonObject] = Field(default_factory=list)
    completed_stages: List[str] = Field(default_factory=list)
    stage_progress: Dict[str, int] = Field(default_factory=dict)
    stage_contributors: Dict[str, List[str]] = Field(default_factory=dict)
    available_choices: List[JsonObject] = Field(default_factory=list)


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
    contributions: List[JsonObject] = Field(default_factory=list)
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
    effective_rules: JsonObject = Field(default_factory=dict)
    solo_mode: bool = False
    controlled_character_ids: List[str] = Field(default_factory=list)
    journal: List[JsonObject] = Field(default_factory=list)
    event_targets: List[str] = Field(default_factory=list)
    event_instance: JsonObject = Field(default_factory=dict)
    event_history: List[JsonObject] = Field(default_factory=list)
    round_summary: JsonObject = Field(default_factory=dict)
    round_snapshot: JsonObject = Field(default_factory=dict, exclude=True)
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
    tasks: Dict[str, JsonObject] = Field(default_factory=dict)
    shared: SharedState = Field(default_factory=SharedState)
    decks: Dict[str, List[str]] = Field(default_factory=lambda: {"culture": [], "events": []})
    market: List[str] = Field(default_factory=list)
    pending_choice: Optional[JsonObject] = None
    legal_actions: List[JsonObject] = Field(default_factory=list, exclude=True)
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
    result: JsonObject = Field(default_factory=dict)
    viewer: JsonObject = Field(default_factory=dict)
    feedback_events: List[FeedbackEvent] = Field(default_factory=list)
    goal_status: GoalStatus = Field(default_factory=GoalStatus)
    processed_request_ids: List[str] = Field(default_factory=list)

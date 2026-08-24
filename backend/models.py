from enum import StrEnum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from .content_schemas import (
    ActionCardContract,
    CultureCardContract,
    DifficultyContract,
    DomainMetaContract,
    EventContract,
    ObjectiveContract,
    ProjectContract,
    RegionContract,
    RoleContract,
    ScenarioContract,
    SiteContract,
    SiteFacetContract,
    TaskContract,
    TerminologyContract,
)

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


class RouteStatus(StrEnum):
    OPEN = "open"
    STRAINED = "strained"
    BLOCKED = "blocked"
    RESTORED = "restored"
    ILLUMINATED = "illuminated"


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"


class Phase(StrEnum):
    ROUND_FORECAST = "round_forecast"
    PLANNING = "planning"
    PLAYER_ACTION = "player_action"
    PENDING_CHOICE = "pending_choice"
    EVENT_RESOLUTION = "event_resolution"
    ROUND_SUMMARY = "round_summary"
    GAME_OVER = "game_over"


class ChoiceKind(StrEnum):
    EVENT = "event"
    VIEW_SELECT = "view_select"
    DISCARD = "discard"
    ACTION_CARD = "action_card"
    ARCHIVE_SELECT = "archive_select"
    ARCHIVE_RETRIEVE = "archive_retrieve"
    ROLE_UPGRADE = "role_upgrade"


class EventStatus(StrEnum):
    FORECAST = "forecast"
    RESOLVED = "resolved"


class DictModel(BaseModel):
    """Typed runtime records that still need the engine's existing dict access."""
    model_config = ConfigDict(validate_assignment=True, extra="forbid")

    def __getitem__(self, key: str):
        return getattr(self, key)

    def __setitem__(self, key: str, value):
        setattr(self, key, value)

    def get(self, key: str, default=None):
        return getattr(self, key, default)

    def setdefault(self, key: str, default=None):
        value = getattr(self, key, None)
        if value is None:
            setattr(self, key, default)
            return default
        return value


class PlayMode(StrEnum):
    SOLO = "solo"
    LOCAL = "local"
    MULTI_DEVICE = "multi_device"

class RoomStatus(StrEnum):
    LOBBY = "lobby"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"

class GameOutcome(StrEnum):
    VICTORY = "victory"
    DEFEAT = "defeat"


class FeedbackChange(BaseModel):
    metric: str
    label: str
    before: int
    after: int
    delta: int


class FeedbackEvent(BaseModel):
    kind: str = "state_change"
    message: str
    changes: List[FeedbackChange] = Field(default_factory=list)


class EventForecastScope(DictModel):
    target_rule: Optional[str] = None
    hidden_target_count: int = 0


class EventRecord(DictModel):
    type: Optional[str] = None
    target_id: Optional[str] = None
    route_id: Optional[str] = None
    result: Optional[str] = None
    label: Optional[str] = None
    changes: Dict[str, JsonValue] = Field(default_factory=dict)
    reason: Optional[str] = None
    amount: Optional[int] = None
    trigger: Optional[str] = None


class EventModifier(DictModel):
    type: str
    action: Optional[str] = None
    amount: Optional[int] = None


class EventInstance(DictModel):
    event_id: Optional[str] = None
    status: EventStatus = EventStatus.FORECAST
    forecast_scope: EventForecastScope = Field(default_factory=EventForecastScope)
    revealed_targets: List[str] = Field(default_factory=list)
    resolved_targets: List[str] = Field(default_factory=list)
    mitigation: List[EventRecord] = Field(default_factory=list)
    resolution: List[EventRecord] = Field(default_factory=list)
    modifiers: List[EventModifier] = Field(default_factory=list)


class PendingChoiceOption(DictModel):
    id: str
    label: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[str] = None
    strategic_direction: Optional[str] = None


class PendingChoice(DictModel):
    kind: ChoiceKind
    options: List[PendingChoiceOption] = Field(default_factory=list)
    cards: List[str] = Field(default_factory=list)
    event_id: Optional[str] = None
    card_id: Optional[str] = None
    player_id: Optional[str] = None
    site_id: Optional[str] = None
    next_card_id: Optional[str] = None
    next_action_card_id: Optional[str] = None
    resume_choice: Optional[JsonObject] = None


class ComboRequirement(DictModel):
    required_combo_tags: List[str] = Field(default_factory=list)
    preferred_origins: List[str] = Field(default_factory=list)
    minimum_distinct_players: int = 0


class StageRequirements(DictModel):
    clues: int = 0
    domains: List[str] = Field(default_factory=list)
    origin_diversity: int = 0
    restoration_resource: int = 0
    contributors: int = 0


class StageReward(DictModel):
    influence: int = 0
    research_clues: int = 0
    restoration_resource: int = 0
    route_connection: int = 0
    weathering_reduction: int = 0
    market_reserve: int = 0
    archive_retrieve: int = 0
    finale_unlock: bool = False
    objective_tags: List[str] = Field(default_factory=list)


class TaskReward(DictModel):
    scroll_delta: int = 0
    restoration_delta: int = 0
    domain: Optional[str] = None
    research_clues: int = 0
    weathering_reduction: int = 0
    influence: int = 0


class StageEvidence(DictModel):
    stage_id: str
    card_id: str
    player_id: str
    action_type: str


class EffectiveRules(DictModel):
    max_rounds: int = 0
    restoration_resource: int = 0
    event_weight: float = 0
    node_damage_base: int = 0
    event_preview_count: int = 0
    solo_ap_bonus: int = 0
    planning_marks_per_round: int = 0
    influence_goal: int = 0
    guidance_level: Optional[str] = None
    show_recommendation_reasons: bool = False
    show_event_target_details: bool = False
    route_action_discount: int = 0
    hand_limit_bonus: int = 0
    virtual_exchange: bool = False


class EffectiveRulesPreview(EffectiveRules):
    scenario_id: str
    difficulty_id: str
    play_mode: PlayMode


class InterpretationPlacement(DictModel):
    card_id: str
    relation: Literal["support", "conflict", "pending"]
    player_id: Optional[str] = None
    origin_tags: List[str] = Field(default_factory=list)
    combo_tags: List[str] = Field(default_factory=list)


class TaskRequirement(DictModel):
    key: str
    label: str
    current: Optional[int] = None
    target: Optional[int] = None
    complete: bool = False
    missing: List[str] = Field(default_factory=list)


class InterpretationEvaluation(DictModel):
    cards: int = 0
    cards_target: int = 0
    domains: List[str] = Field(default_factory=list)
    missing_domains: List[str] = Field(default_factory=list)
    origins: List[str] = Field(default_factory=list)
    origins_target: int = 0
    missing_origins: List[str] = Field(default_factory=list)
    missing_tags: List[str] = Field(default_factory=list)
    has_support: bool = False
    contributors: List[str] = Field(default_factory=list)
    contributors_target: int = 0
    missing_contributors: int = 0
    support: int = 0
    conflict: int = 0
    pending: int = 0
    confidence: int = 0
    requirements: List[TaskRequirement] = Field(default_factory=list)
    can_form: bool = False
    reason: str = ""


class InterpretationState(DictModel):
    placements: List[InterpretationPlacement] = Field(default_factory=list)
    formed: bool = False
    intervention: Optional[Literal["act_now", "minimal", "record"]] = None
    confidence: int = 0


class TaskProgress(DictModel):
    requirements: List[TaskRequirement] = Field(default_factory=list)
    complete: bool = False
    interpretation: InterpretationEvaluation = Field(default_factory=InterpretationEvaluation)


class RoundMetrics(DictModel):
    weathering: int = 0
    weathering_track: int = 0
    restoration_resource: int = 0
    research_clues: int = 0
    influence: int = 0


class RoundEntityChange(DictModel):
    id: str = ""
    label: str = ""
    kind: str = "site"
    before: int = 0
    after: int = 0
    delta: int = 0
    status_before: Optional[str] = None
    status_after: Optional[str] = None


class RoundSummary(DictModel):
    round: int = 0
    event_id: Optional[str] = None
    event_targets: List[str] = Field(default_factory=list)
    event_resolution: List[EventRecord] = Field(default_factory=list)
    before: RoundMetrics = Field(default_factory=RoundMetrics)
    after: RoundMetrics = Field(default_factory=RoundMetrics)
    planning_mark_count: int = 0
    planning_marks: int = 0
    weathering_track: int = 0
    restoration_resource: int = 0
    completed_projects: int = 0
    completed_objectives: int = 0
    player_contributions: Dict[str, int] = Field(default_factory=dict)
    round_effects: List[EventRecord] = Field(default_factory=list)
    site_changes: List[RoundEntityChange] = Field(default_factory=list)
    route_changes: List[RoundEntityChange] = Field(default_factory=list)
    next_priority: Optional[str] = None


class ProjectStage(DictModel):
    id: str = ""
    name: str = ""
    action_type: str = "interpret_evidence"
    required_progress: int = 1
    stage_text: Optional[str] = None
    requirements: StageRequirements = Field(default_factory=StageRequirements)
    reward: StageReward = Field(default_factory=StageReward)
    choices: List[JsonObject] = Field(default_factory=list)


class TaskState(DictModel):
    id: str = ""
    site_id: str = ""
    name: str = ""
    required_domains: List[str] = Field(default_factory=list)
    required_origin_diversity: int = 1
    required_card_count: int = 1
    combo_requirement: ComboRequirement = Field(default_factory=ComboRequirement)
    reward: TaskReward = Field(default_factory=TaskReward)
    contributed_cards: List[str] = Field(default_factory=list)
    contribution_records: List[InterpretationPlacement] = Field(default_factory=list)
    interpretation: InterpretationState = Field(default_factory=InterpretationState)
    progress: TaskProgress = Field(default_factory=TaskProgress)
    contributed_by_player: Dict[str, int] = Field(default_factory=dict)
    contributing_player_ids: List[str] = Field(default_factory=list)
    content_class: Optional[str] = None
    description: Optional[str] = None
    culture_explanation: Optional[str] = None
    learning_objective: Optional[str] = None
    required_cards_per_player_min: Optional[int] = None
    route_synergy: Optional[str] = None
    strategic_role: Optional[str] = None
    ui_instruction: Optional[str] = None
    completed: bool = False


class PlanningMark(DictModel):
    target_id: str
    turn: str
    collaborated: bool = False
    collaboration_action: Optional[str] = None


class JournalEntry(DictModel):
    id: str
    round: int = 0
    type: str = "action"
    message: str = ""
    effects: List[JsonObject] = Field(default_factory=list)
    created_at: str = ""
    player_id: Optional[str] = None
    target: Optional[JsonObject] = None


class EventHistoryRecord(EventInstance):
    round: int = 0
    event_targets: List[str] = Field(default_factory=list)


class GoalCondition(BaseModel):
    id: str
    label: str
    current: int
    target: int
    remaining: int
    kind: Literal['progress', 'guardrail', 'deadline'] = 'progress'
    operator: Literal['gte', 'lt', 'lte'] = 'gte'
    status: Literal['incomplete', 'safe', 'warning', 'completed', 'failed'] = 'incomplete'
    related_ids: List[str] = Field(default_factory=list)
    related_labels: List[str] = Field(default_factory=list)


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
    victory_conditions: List[GoalCondition] = Field(default_factory=list)
    failure_conditions: List[GoalCondition] = Field(default_factory=list)


class ViewerSeat(BaseModel):
    seat_id: str
    player_id: Optional[str] = None
    name: Optional[str] = None
    role_id: Optional[str] = None
    ready: bool = False
    connected: bool = False


class ViewerState(BaseModel):
    seat_id: Optional[str] = None
    player_id: Optional[str] = None
    controlled_player_ids: List[str] = Field(default_factory=list)
    can_act: bool = False
    can_manage_room: bool = False
    play_mode: PlayMode = PlayMode.SOLO
    paused: bool = False
    room_id: Optional[str] = None
    room_status: Optional[RoomStatus] = None
    seats: List[ViewerSeat] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: JsonObject = Field(default_factory=dict)
    recovery: Optional[str] = None


class MetaResponse(BaseModel):
    schema_version: int
    mode: str
    domains: List[str]
    domain_meta: Dict[str, DomainMetaContract] = Field(default_factory=dict)
    terminology: TerminologyContract = Field(default_factory=lambda: TerminologyContract(domains={}, origins={}, statuses={}, actions={}, resources={}, event_target_rules={}, combo_tags={}, errors={}))
    regions: List[RegionContract] = Field(default_factory=list)
    scenarios: List[ScenarioContract] = Field(default_factory=list)
    roles: List[RoleContract] = Field(default_factory=list)
    sites: List[SiteContract] = Field(default_factory=list)
    facets: List[SiteFacetContract] = Field(default_factory=list)
    cards: List[CultureCardContract] = Field(default_factory=list)
    action_cards: List[ActionCardContract] = Field(default_factory=list)
    events: List[EventContract] = Field(default_factory=list)
    tasks: List[TaskContract] = Field(default_factory=list)
    projects: List[ProjectContract] = Field(default_factory=list)
    objectives: List[ObjectiveContract] = Field(default_factory=list)
    difficulty: List[DifficultyContract] = Field(default_factory=list)
    effective_rules_preview: Dict[str, EffectiveRulesPreview] = Field(default_factory=dict)


class RoomSeat(BaseModel):
    seat_id: str
    name: str
    role_id: Optional[str] = None
    ready: bool = False
    connected: bool = False
    role_locked: bool = False


class RoomPublic(BaseModel):
    room_id: str
    status: RoomStatus
    play_mode: PlayMode
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
    recovery_token: Optional[str] = None
    session_id: Optional[str] = None


class RoomStartResponse(BaseModel):
    room: RoomPublic
    session_id: str


class RoomEventTicket(BaseModel):
    ticket: str
    expires_in: int


class ArchivePlayer(BaseModel):
    name: str
    role_id: Optional[str] = None


class ArchiveSummary(BaseModel):
    archive_id: str
    room_id: Optional[str] = None
    mode: str
    status: str
    scenario_id: str
    difficulty_id: str
    turn: int
    max_rounds: int
    updated_at: Optional[str] = None
    outcome: Optional[GameOutcome] = None
    players: List[ArchivePlayer] = Field(default_factory=list)

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
    preview_delta: Dict[str, int] = Field(default_factory=dict)
    payload: JsonObject = Field(default_factory=dict)
    recommendation_score: int = 0
    reason: str = ""


class ActionOption(BaseModel):
    id: str
    type: ActionType
    label: str
    category_label: str = "基础行动"
    action_label: str = ""
    description: str = ""
    cost: Dict[str, int] = Field(default_factory=lambda: {"ap": 0})
    enabled: bool = True
    disabled_reason: Optional[str] = None
    targets: List[ActionTarget] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    recommendation_score: int = 0
    reason: str = ""
    preview_delta: Dict[str, int] = Field(default_factory=dict)
    confirmation: str = ""
    payload: JsonObject = Field(default_factory=dict)

class CreateGameRequest(BaseModel):
    player_ids: List[str] = Field(default_factory=lambda: ["p1", "p2"])
    difficulty_id: str = "normal"
    scenario_id: str = "sand_and_stone"
    seed: Optional[int] = None
    daily_seed: Optional[str] = None


class RoomCreateRequest(BaseModel):
    play_mode: PlayMode = PlayMode.SOLO
    name: str = "同行者"
    role_id: Optional[str] = None
    scenario_id: str = "sand_and_stone"
    difficulty_id: str = "guided"
    seed: Optional[int] = None
    max_players: int = Field(default=4, ge=1, le=4)
    archive_id: Optional[str] = None
    archive_recovery_token: Optional[str] = Field(default=None, min_length=32, max_length=128)


class RoomJoinRequest(BaseModel):
    name: str = "同行者"
    role_id: Optional[str] = None


class RoomReconnectRequest(BaseModel):
    seat_id: str
    recovery_token: str = Field(min_length=32, max_length=128)


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


class PublicPlayerState(BaseModel):
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
    skill_used: bool = False
    contributions: int = 0
    upgrades: List[str] = Field(default_factory=list)


class RouteState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    id: str
    from_site: str
    to_site: str
    cost: int = 1
    status: RouteStatus = RouteStatus.OPEN
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
    model_config = ConfigDict(validate_assignment=True)
    id: str
    site_id: str
    name: str
    stages: List[ProjectStage] = Field(default_factory=list)
    stage_index: int = 0
    progress: int = 0
    status: ProjectStatus = ProjectStatus.ACTIVE
    contributors: List[str] = Field(default_factory=list)
    stage_evidence: List[StageEvidence] = Field(default_factory=list)
    completed_stages: List[str] = Field(default_factory=list)
    stage_progress: Dict[str, int] = Field(default_factory=dict)
    stage_contributors: Dict[str, List[str]] = Field(default_factory=dict)
    stage_receipts: Dict[str, Dict[str, int]] = Field(default_factory=dict)
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


class ResultState(BaseModel):
    outcome: Optional[GameOutcome] = None
    outcome_reason: Optional[str] = None
    outcome_summary: str = ""
    score: ScoreState = Field(default_factory=ScoreState)
    completed_objectives: List[str] = Field(default_factory=list)
    completed_projects: List[str] = Field(default_factory=list)
    seed: int = 0

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
    contributions: List[InterpretationPlacement] = Field(default_factory=list)
    active_project_id: Optional[str] = None

class SharedState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    turn: int = 1
    max_rounds: int = 8
    active_player_id: str = "p1"
    player_order: List[str] = Field(default_factory=lambda: ["p1", "p2"])
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
    planning_marks: Dict[str, List[PlanningMark]] = Field(default_factory=dict)
    node_ability_uses: List[str] = Field(default_factory=list)
    phase: Phase = Phase.PLAYER_ACTION
    weathering_track: int = 0
    weathering_limit: int = 5
    effective_rules: EffectiveRules = Field(default_factory=EffectiveRules)
    solo_mode: bool = False
    controlled_character_ids: List[str] = Field(default_factory=list)
    journal: List[JournalEntry] = Field(default_factory=list)
    event_targets: List[str] = Field(default_factory=list)
    event_instance: EventInstance = Field(default_factory=EventInstance)
    event_history: List[EventHistoryRecord] = Field(default_factory=list)
    round_summary: RoundSummary = Field(default_factory=RoundSummary)
    round_snapshot: JsonObject = Field(default_factory=dict, exclude=True)
    reserved_market_cards: List[str] = Field(default_factory=list)
    scenario_rule_uses: List[str] = Field(default_factory=list)
    scenario_round_baseline: JsonObject = Field(default_factory=dict)
    tutorial_steps: Dict[str, bool] = Field(default_factory=dict)


class PublicSharedState(BaseModel):
    turn: int = 1
    max_rounds: int = 8
    active_player_id: str = "p1"
    player_order: List[str] = Field(default_factory=lambda: ["p1", "p2"])
    influence: int = 0
    restoration_resource: int = 6
    completed_domains: List[str] = Field(default_factory=list)
    current_event_id: Optional[str] = None
    outcome: Optional[GameOutcome] = None
    outcome_reason: Optional[str] = None
    scenario_id: str = "sand_and_stone"
    research_clues: int = 0
    route_connection_score: int = 0
    planning_marks: Dict[str, List[PlanningMark]] = Field(default_factory=dict)
    phase: Phase = Phase.PLAYER_ACTION
    weathering_track: int = 0
    weathering_limit: int = 5
    effective_rules: EffectiveRules = Field(default_factory=EffectiveRules)
    solo_mode: bool = False
    controlled_character_ids: List[str] = Field(default_factory=list)
    journal: List[JournalEntry] = Field(default_factory=list)
    event_targets: List[str] = Field(default_factory=list)
    event_instance: EventInstance = Field(default_factory=EventInstance)
    event_history: List[EventHistoryRecord] = Field(default_factory=list)
    round_summary: RoundSummary = Field(default_factory=RoundSummary)
    reserved_market_cards: List[str] = Field(default_factory=list)

class GameState(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    schema_version: int = 3
    revision: int = 0
    session_id: str
    mode: str = "heritage_network"
    difficulty_id: str = "normal"
    players: Dict[str, PlayerState]
    sites: Dict[str, SiteState]
    tasks: Dict[str, TaskState] = Field(default_factory=dict)
    shared: SharedState = Field(default_factory=SharedState)
    decks: Dict[str, List[str]] = Field(default_factory=lambda: {"culture": [], "events": []})
    market: List[str] = Field(default_factory=list)
    pending_choice: Optional[PendingChoice] = None
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
    result: ResultState = Field(default_factory=ResultState)
    viewer: ViewerState = Field(default_factory=ViewerState)
    feedback_events: List[FeedbackEvent] = Field(default_factory=list)
    goal_status: GoalStatus = Field(default_factory=GoalStatus)
    processed_request_ids: List[str] = Field(default_factory=list)


class GameStateResponse(BaseModel):
    """Public game DTO; persistence-only engine fields never cross this boundary."""
    schema_version: int
    revision: int
    session_id: str
    mode: str
    difficulty_id: str
    players: Dict[str, PublicPlayerState]
    sites: Dict[str, SiteState]
    tasks: Dict[str, TaskState] = Field(default_factory=dict)
    shared: PublicSharedState
    deck_counts: Dict[str, int] = Field(default_factory=dict)
    market: List[str] = Field(default_factory=list)
    pending_choice: Optional[PendingChoice] = None
    action_options: List[ActionOption] = Field(default_factory=list)
    scenario_id: str
    seed: int
    routes: Dict[str, RouteState] = Field(default_factory=dict)
    projects: Dict[str, ProjectState] = Field(default_factory=dict)
    objectives: Dict[str, ObjectiveState] = Field(default_factory=dict)
    score: ScoreState = Field(default_factory=ScoreState)
    result: ResultState = Field(default_factory=ResultState)
    viewer: ViewerState = Field(default_factory=ViewerState)
    feedback_events: List[FeedbackEvent] = Field(default_factory=list)
    goal_status: GoalStatus = Field(default_factory=GoalStatus)

    @model_validator(mode="before")
    @classmethod
    def project_deck_counts(cls, value):
        data = dict(value) if isinstance(value, dict) else value.model_dump()
        decks = data.pop("decks", {}) or {}
        data["deck_counts"] = {str(key): len(items) for key, items in decks.items() if isinstance(items, list)}
        return data

from __future__ import annotations

from collections.abc import Mapping

from pydantic import BaseModel, ConfigDict, Field, JsonValue, TypeAdapter

JsonObject = dict[str, JsonValue]


class ComboRequirementContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required_combo_tags: list[str] = Field(default_factory=list)
    preferred_origins: list[str] = Field(default_factory=list)
    minimum_distinct_players: int = Field(default=0, ge=0)


class ProjectStageContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    required_progress: int = Field(default=1, ge=0)
    action_type: str
    requirements: JsonObject = Field(default_factory=dict)
    stage_text: str | None = None


class ContentItemContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    content_class: str = Field(pattern="^(documented|interpretive|gameplay)$")


class SiteContract(ContentItemContract):
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    connections: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    node_ability: JsonObject | None = None
    active_task_id: str | None = None
    gameplay_hint: str | None = None
    icon_asset: str | None = None
    layout: JsonObject | None = None
    max_damage: int | None = None
    region_id: str | None = None
    scene_asset: str | None = None
    site_tags: list[str] = Field(default_factory=list)
    start_damage: int | None = None
    strategic_role: str | None = None
    summary: str | None = None
    type: str | None = None


class TaskContract(ContentItemContract):
    site_id: str
    required_domains: list[str] = Field(min_length=1)
    required_origin_diversity: int = Field(ge=1)
    required_card_count: int = Field(ge=1)
    combo_requirement: ComboRequirementContract = Field(default_factory=ComboRequirementContract)
    reward: JsonObject = Field(default_factory=dict)
    culture_explanation: str | None = None
    learning_objective: str | None = None
    required_cards_per_player_min: int | None = None
    route_synergy: str | None = None
    strategic_role: str | None = None
    ui_instruction: str | None = None


class ProjectContract(ContentItemContract):
    site_id: str
    stages: list[ProjectStageContract] = Field(min_length=1)
    project_type: str | None = None
    reward: JsonObject = Field(default_factory=dict)
    strategy_note: str | None = None
    summary: str | None = None


class RoleContract(ContentItemContract):
    content_class: str = "gameplay"
    start_site_id: str
    upgrade_ids: list[str] = Field(default_factory=list)
    ability: JsonObject
    color: str | None = None
    icon: str | None = None
    icon_asset: str | None = None
    meaning: str | None = None
    origin: str | None = None
    play_style: str | None = None
    solo_rule: str | None = None
    starting_hint: str | None = None
    team_role: str | None = None


class ScenarioRuleContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str
    trigger: str
    effect: JsonObject


class ScenarioContract(ContentItemContract):
    content_class: str = "gameplay"
    enabled_site_ids: list[str] = Field(min_length=1)
    card_pool: dict[str, int] = Field(min_length=1)
    scenario_rule: ScenarioRuleContract | None = None
    action_card_pool: dict[str, int] = Field(default_factory=dict)
    blocked_route_count: int | None = None
    closed_site_limit: int | None = None
    core_project_id: str | None = None
    description: str | None = None
    enabled_project_ids: list[str] = Field(default_factory=list)
    event_chain_ids: list[str] = Field(default_factory=list)
    event_deck: list[str] = Field(default_factory=list)
    failure_brief: str | None = None
    victory_brief: str | None = None
    influence_goal: int | None = None
    initial_damage: JsonObject | None = None
    max_rounds: int | None = None
    objective_ids: list[str] = Field(default_factory=list)
    recommended_minutes: str | int | None = None
    recommended_players: list[int] = Field(default_factory=list)
    restoration_resource: int | None = None
    solo_rules: JsonObject | None = None
    starting_clues: int | None = None
    starting_weathering: int | None = None


class ActionCardContract(ContentItemContract):
    cost: int = Field(ge=0)
    timing: str
    action_type: str
    best_use: str
    limitations: str
    combo_tags: list[str] = Field(default_factory=list)
    effect: JsonObject
    description: str | None = None
    name: str
    strategic_role: str | None = None
    target_rule: str | None = None


class EventContract(ContentItemContract):
    target_rule: str
    preview_delta: JsonObject = Field(default_factory=dict)
    mitigation_hint: str = ""
    effect: JsonObject
    damage: int | None = None
    description: str | None = None
    difficulty_weight: float | None = None
    forecast_text: str | None = None
    mitigation_hint: str | None = None
    modifier: JsonValue | None = None
    modifiers: list[JsonObject] = Field(default_factory=list)
    name: str
    scene_asset: str | None = None
    severity: int | None = None
    tags: list[str] = Field(default_factory=list)


class ObjectiveContract(ContentItemContract):
    content_class: str = "gameplay"
    type: str
    target: int = Field(ge=1)
    completion_text: str | None = None
    description: str | None = None
    progress_text: str | None = None
    scoring_weight: int | None = None
    strategy_hint: str | None = None


class CultureCardContract(ContentItemContract):
    domain: str
    description: str
    icon_asset: str
    origin_tags: list[str] = Field(min_length=1)
    combo_name: str | None = None
    combo_reward_text: str | None = None
    combo_tags: list[str] = Field(default_factory=list)
    combo_with_domains: list[str] = Field(default_factory=list)
    culture_note: str | None = None
    effect: JsonObject = Field(default_factory=dict)
    era_tags: list[str] = Field(default_factory=list)
    event_option_tags: list[str] = Field(default_factory=list)
    evidence_use_text: str | None = None
    finale_tags: list[str] = Field(default_factory=list)
    instant_use_text: str | None = None
    rarity: str | None = None
    site_tags: list[str] = Field(default_factory=list)
    strategic_role: str | None = None
    technique_tags: list[str] = Field(default_factory=list)


class RouteContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    from_: str = Field(alias="from")
    to: str
    active_project_id: str | None = None
    connection_level: int = 0
    cost: int = Field(ge=0)
    directional_rules: JsonObject | None = None
    event_tags: list[str] = Field(default_factory=list)
    evidence_tags: list[str] = Field(default_factory=list)
    labelPosition: list[float] | None = None
    name: str | None = None
    risk: int = 0
    risk_profile: str | None = None
    roadClass: str | None = None
    status: str = "open"
    strategic_role: str | None = None
    tags: list[str] = Field(default_factory=list)
    terrain: str | None = None
    ui_hint: str | None = None
    waypoints: list[float] = Field(default_factory=list)


class RegionContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    site_ids: list[str] = Field(min_length=1)
    label_position: dict[str, float] | None = None
    visual_token: str | None = None
    description: str
    gameplay_focus: str
    entry_hint: str
    risk_profile: str


class SiteFacetContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    site_id: str
    kind: str
    name: str
    description: str
    evidence_domains: list[str] = Field(min_length=1)
    gameplay_hint: str


class TaskTemplateContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    stage_types: list[str] = Field(min_length=1)
    required_progress: list[int] = Field(min_length=1)
    recommended_domains: int | list[str] | None = None
    recommended_origins: int | list[str] | None = None
    recommended_tags: str | list[str] | None = None
    rule_text: str
    complexity: str
    minimum_players: int | None = Field(default=None, ge=1)


class EventChainContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    event_ids: list[str] = Field(min_length=1)
    description: str
    entry_tags: list[str] = Field(default_factory=list)
    resolution_hint: str


class RoleUpgradeContract(ContentItemContract):
    role_id: str
    description: str
    effect: JsonObject
    trigger: str
    strategic_direction: str


class AchievementContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    condition: str
    description: str


class TerminologyContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domains: dict[str, JsonObject]
    origins: dict[str, JsonObject]
    statuses: dict[str, JsonObject]
    actions: dict[str, JsonObject]
    resources: dict[str, JsonObject]
    event_target_rules: dict[str, str]
    combo_tags: dict[str, JsonObject]
    errors: dict[str, str | JsonObject]


class DomainMetaContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    short_name: str
    color_token: str | None = None
    description: str | None = None


class DifficultyContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    description: str
    max_rounds: int = Field(ge=1)
    restoration_resource: int = Field(ge=0)
    event_weight: float = Field(ge=0)
    node_damage_base: int = Field(ge=0)
    event_preview_count: int = Field(ge=0)
    recommended_experience: str
    solo_ap_bonus: int = Field(ge=0)


def _items(value: object, key: str) -> list[dict]:
    if isinstance(value, list):
        return value
    if isinstance(value, Mapping):
        items = value.get(key, [])
        return items if isinstance(items, list) else []
    return []


def _assert_no_placeholders(value: object, path: str = "data") -> None:
    if isinstance(value, str):
        lowered = value.lower()
        if "todo_content_review" in lowered or "placeholder" in lowered:
            raise ValueError(f"content placeholder remains: {path}")
    elif isinstance(value, Mapping):
        for key, item in value.items():
            _assert_no_placeholders(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _assert_no_placeholders(item, f"{path}[{index}]")


def validate_content_contracts(files: Mapping[str, object]) -> None:
    """Validate every player-facing JSON collection before the engine starts."""
    _assert_no_placeholders(files)
    sites = _items(files.get("sites", []), "sites")
    routes = _items(files.get("routes", []), "routes")
    tasks = _items(files.get("tasks", []), "tasks")
    projects = _items(files.get("projects", []), "projects")
    roles = _items(files.get("roles", []), "roles")
    scenarios = _items(files.get("scenarios", []), "scenarios")
    action_cards = _items(files.get("action_cards", []), "cards")
    events = _items(files.get("events", []), "events")
    objectives = _items(files.get("objectives", []), "objectives")
    cards = _items(files.get("culture_cards", []), "cards")
    regions = _items(files.get("regions", []), "regions")
    facets = _items(files.get("site_facets", []), "facets")
    task_templates = _items(files.get("task_templates", []), "task_templates")
    event_chains = _items(files.get("event_chains", []), "event_chains")
    role_upgrades = _items(files.get("role_upgrades", []), "role_upgrades")
    achievements = _items(files.get("achievements", []), "achievements")
    site_ids = {item["id"] for item in sites}
    card_ids = {item["id"] for item in _items(files.get("culture_cards", []), "cards")}
    upgrade_ids = {item["id"] for item in _items(files.get("role_upgrades", []), "role_upgrades")}

    TypeAdapter(list[SiteContract]).validate_python(sites)
    TypeAdapter(list[TaskContract]).validate_python(tasks)
    TypeAdapter(list[ProjectContract]).validate_python(projects)
    TypeAdapter(list[RoleContract]).validate_python(roles)
    TypeAdapter(list[ScenarioContract]).validate_python(scenarios)
    TypeAdapter(list[ActionCardContract]).validate_python(action_cards)
    TypeAdapter(list[EventContract]).validate_python(events)
    TypeAdapter(list[ObjectiveContract]).validate_python(objectives)
    TypeAdapter(list[CultureCardContract]).validate_python(cards)
    TypeAdapter(list[RouteContract]).validate_python(routes)
    TypeAdapter(list[RegionContract]).validate_python(regions)
    TypeAdapter(list[SiteFacetContract]).validate_python(facets)
    TypeAdapter(list[TaskTemplateContract]).validate_python(task_templates)
    TypeAdapter(list[EventChainContract]).validate_python(event_chains)
    TypeAdapter(list[RoleUpgradeContract]).validate_python(role_upgrades)
    TypeAdapter(list[AchievementContract]).validate_python(achievements)
    if files.get("terminology"):
        TerminologyContract.model_validate(files["terminology"])

    for route in routes:
        start = route.get("from") or route.get("from_site")
        end = route.get("to") or route.get("to_site")
        if start not in site_ids or end not in site_ids:
            raise ValueError(f"route references unknown site: {route.get('id')}")
    for region in regions:
        if any(site_id not in site_ids for site_id in region.get("site_ids", [])):
            raise ValueError(f"region references unknown site: {region.get('id')}")
    for facet in facets:
        if facet.get("site_id") not in site_ids:
            raise ValueError(f"site facet references unknown site: {facet.get('id')}")
    for chain in event_chains:
        if any(event_id not in {event.get("id") for event in events} for event_id in chain.get("event_ids", [])):
            raise ValueError(f"event chain references unknown event: {chain.get('id')}")
    for upgrade in role_upgrades:
        if upgrade.get("role_id") not in {role.get("id") for role in roles}:
            raise ValueError(f"role upgrade references unknown role: {upgrade.get('id')}")
    for role in roles:
        if role["start_site_id"] not in site_ids:
            raise ValueError(f"role references unknown start site: {role['id']}")
        if any(upgrade not in upgrade_ids for upgrade in role.get("upgrade_ids", [])):
            raise ValueError(f"role references unknown upgrade: {role['id']}")
    for task in tasks:
        if task["site_id"] not in site_ids:
            raise ValueError(f"task references unknown site: {task['id']}")
    for project in projects:
        if project["site_id"] not in site_ids:
            raise ValueError(f"project references unknown site: {project['id']}")
        for stage in project["stages"]:
            if not stage.get("id") or not stage.get("action_type"):
                raise ValueError(f"project stage is incomplete: {project['id']}")
    for scenario in scenarios:
        if any(site_id not in site_ids for site_id in scenario.get("enabled_site_ids", [])):
            raise ValueError(f"scenario references unknown site: {scenario['id']}")
        if any(project_id not in {project.get("id") for project in projects} for project_id in scenario.get("enabled_project_ids", [])):
            raise ValueError(f"scenario references unknown project: {scenario['id']}")
        if scenario.get("core_project_id") and scenario["core_project_id"] not in {project.get("id") for project in projects}:
            raise ValueError(f"scenario references unknown core project: {scenario['id']}")
        if any(objective_id not in {objective.get("id") for objective in objectives} for objective_id in scenario.get("objective_ids", [])):
            raise ValueError(f"scenario references unknown objective: {scenario['id']}")
        event_ids = {event.get("id") for event in events}
        if any(event_id not in event_ids for event_id in scenario.get("event_deck", [])):
            raise ValueError(f"scenario references unknown event: {scenario['id']}")
        if any(card not in card_ids or count < 1 for card, count in scenario["card_pool"].items()):
            raise ValueError(f"scenario card pool is invalid: {scenario['id']}")
        if not scenario["card_pool"]:
            raise ValueError(f"scenario card pool is empty: {scenario['id']}")

    for scenario in scenarios:
        enabled_sites = set(scenario["enabled_site_ids"])
        pool = {card_id: count for card_id, count in scenario["card_pool"].items()}
        pool_cards = [card for card in cards if card.get("id") in pool]
        available_domains = {card.get("domain") for card in pool_cards}
        available_origins = {origin for card in pool_cards for origin in card.get("origin_tags", [])}
        available_combos = {tag for card in pool_cards for tag in card.get("combo_tags", [])}
        available_card_count = sum(pool.values())
        for task in tasks:
            if task["site_id"] not in enabled_sites:
                continue
            required_domains = set(task.get("required_domains", []))
            if not required_domains.issubset(available_domains):
                raise ValueError(f"scenario task has no matching domain card: {scenario['id']}:{task['id']}")
            if task.get("required_origin_diversity", 1) > len(available_origins):
                raise ValueError(f"scenario task has insufficient source diversity: {scenario['id']}:{task['id']}")
            required_combos = set((task.get("combo_requirement") or {}).get("required_combo_tags", []))
            if not required_combos.issubset(available_combos):
                raise ValueError(f"scenario task has no matching combo card: {scenario['id']}:{task['id']}")
            if task.get("required_card_count", 1) > available_card_count:
                raise ValueError(f"scenario task has insufficient cards: {scenario['id']}:{task['id']}")

from __future__ import annotations

from collections.abc import Mapping

from pydantic import BaseModel, ConfigDict, Field, JsonValue, TypeAdapter

JsonObject = dict[str, JsonValue]


class ContentItemContract(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    content_class: str = Field(pattern="^(documented|interpretive|gameplay)$")


class SiteContract(ContentItemContract):
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    connections: list[str] = Field(default_factory=list)


class TaskContract(ContentItemContract):
    site_id: str
    required_domains: list[str] = Field(min_length=1)
    required_origin_diversity: int = Field(ge=1)
    required_card_count: int = Field(ge=1)
    combo_requirement: JsonObject = Field(default_factory=dict)
    reward: JsonObject = Field(default_factory=dict)


class ProjectContract(ContentItemContract):
    site_id: str
    stages: list[JsonObject] = Field(min_length=1)


class RoleContract(ContentItemContract):
    content_class: str = "gameplay"
    start_site_id: str
    upgrade_ids: list[str] = Field(default_factory=list)
    ability: JsonObject


class ScenarioRuleContract(BaseModel):
    model_config = ConfigDict(extra="allow")
    description: str
    trigger: str
    effect: JsonObject


class ScenarioContract(ContentItemContract):
    content_class: str = "gameplay"
    enabled_site_ids: list[str] = Field(min_length=1)
    card_pool: dict[str, int] = Field(min_length=1)
    scenario_rule: ScenarioRuleContract | None = None


class ActionCardContract(ContentItemContract):
    cost: int = Field(ge=0)
    timing: str
    action_type: str
    best_use: str
    limitations: str
    combo_tags: list[str] = Field(default_factory=list)
    effect: JsonObject


class EventContract(ContentItemContract):
    target_rule: str
    preview_delta: JsonObject = Field(default_factory=dict)
    mitigation_hint: str = ""
    effect: JsonObject


class ObjectiveContract(ContentItemContract):
    content_class: str = "gameplay"
    type: str
    target: int = Field(ge=1)


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

    for route in routes:
        start = route.get("from") or route.get("from_site")
        end = route.get("to") or route.get("to_site")
        if start not in site_ids or end not in site_ids:
            raise ValueError(f"route references unknown site: {route.get('id')}")
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
        if any(card not in card_ids or count < 1 for card, count in scenario["card_pool"].items()):
            raise ValueError(f"scenario card pool is invalid: {scenario['id']}")
        if not scenario["card_pool"]:
            raise ValueError(f"scenario card pool is empty: {scenario['id']}")

    cards = _items(files.get("culture_cards", []), "cards")
    for scenario in scenarios:
        enabled_sites = set(scenario["enabled_site_ids"])
        pool = set(scenario["card_pool"])
        available_domains = {card.get("domain") for card in cards if card.get("id") in pool}
        for task in tasks:
            if task["site_id"] in enabled_sites and not set(task.get("required_domains", [])) & available_domains:
                raise ValueError(f"scenario task has no matching domain card: {scenario['id']}:{task['id']}")

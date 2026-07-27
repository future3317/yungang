"""Validate game content references before the FastAPI process starts."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.mechanisms import validate_content_mechanisms

ROOT = Path(__file__).resolve().parents[1] / "data"
def load(name): return json.loads((ROOT / name).read_text(encoding="utf-8-sig"))
def items(name, key):
    value = load(name)
    return value if isinstance(value, list) else value.get(key, [])

def main():
    entry = load("game_data.json")
    assert entry["content_schema_version"] == 3
    domains = set(entry["domains"])
    roles = {item["id"]: item for item in items("roles.json", "roles")}
    sites = {item["id"]: item for item in items("sites.json", "sites")}
    cards = {item["id"]: item for item in items("culture_cards.json", "cards")}
    tasks = {item["id"]: item for item in items("tasks.json", "tasks")}
    events = {item["id"]: item for item in items("events.json", "events")}
    routes = items("routes.json", "routes")
    regions = items("regions.json", "regions")
    facets = items("site_facets.json", "facets")
    scenarios = items("scenarios.json", "scenarios")
    projects = items("projects.json", "projects")
    action_cards = items("action_cards.json", "cards")
    role_upgrades = items("role_upgrades.json", "role_upgrades")
    objectives = items("objectives.json", "objectives")
    assert sites and roles and cards and tasks and events
    assert all(0 <= site["x"] <= 100 and 0 <= site["y"] <= 100 for site in sites.values())
    assert all(route["from"] in sites and route["to"] in sites and route["cost"] >= 0 for route in routes)
    assert all(role.get("start_site_id") in sites for role in roles.values())
    assert all(task.get("site_id") in sites for task in tasks.values())
    assert all(set(task.get("required_domains", [])) <= domains for task in tasks.values())
    assert all(card.get("domain") in domains for card in cards.values())
    assert all(site.get("content_class") in {"documented", "interpretive", "gameplay"} for site in sites.values())
    assert all(route.get("waypoints") is not None and route.get("roadClass") for route in routes)
    content_items = [*cards.values(), *events.values(), *tasks.values(), *(projects.values() if isinstance(projects, dict) else projects), *action_cards, *role_upgrades]
    assert all(item.get("content_class") in {"documented", "interpretive", "gameplay"} for item in content_items)
    validate_content_mechanisms({"sites": list(sites.values()), "culture_cards": list(cards.values()), "events": events, "action_cards": action_cards, "role_upgrades": role_upgrades, "projects": projects})
    assert len(sites) >= 24 and len(routes) >= 42 and len(cards) >= 48 and len(action_cards) >= 16 and len(events) >= 24 and len(projects) >= 12
    assert len(regions) >= 4 and len(facets) >= len(sites) * 3 and len(scenarios) >= 4 and len(projects) >= 6 and len(objectives) >= 5
    print(f"content valid: schema v3, {len(sites)} sites, {len(routes)} routes, {len(cards)} cards, {len(events)} events, {len(scenarios)} scenarios")

if __name__ == "__main__": main()

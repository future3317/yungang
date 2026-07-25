"""Validate game content references before the FastAPI process starts."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data"
def load(name): return json.loads((ROOT / name).read_text(encoding="utf-8-sig"))
def items(name, key):
    value = load(name)
    return value if isinstance(value, list) else value.get(key, [])

def main():
    entry = load("game_data.json")
    assert entry["content_schema_version"] == 2
    domains = set(entry["domains"])
    roles = {item["id"]: item for item in items("roles.json", "roles")}
    sites = {item["id"]: item for item in items("sites.json", "sites")}
    cards = {item["id"]: item for item in items("culture_cards.json", "cards")}
    tasks = {item["id"]: item for item in items("tasks.json", "tasks")}
    events = {item["id"]: item for item in items("events.json", "events")}
    routes = items("routes.json", "routes")
    assert sites and roles and cards and tasks and events
    assert all(0 <= site["x"] <= 100 and 0 <= site["y"] <= 100 for site in sites.values())
    assert all(route["from"] in sites and route["to"] in sites and route["cost"] >= 0 for route in routes)
    assert all(role.get("start_site_id") in sites for role in roles.values())
    assert all(task.get("site_id") in sites for task in tasks.values())
    assert all(set(task.get("required_domains", [])) <= domains for task in tasks.values())
    assert all(card.get("domain") in domains for card in cards.values())
    print(f"content valid: {len(sites)} sites, {len(routes)} routes, {len(cards)} cards, {len(events)} events")

if __name__ == "__main__": main()

import json
from pathlib import Path
from .mechanisms import validate_content_mechanisms

class Content:
    def __init__(self, root=None):
        self.root = Path(root or Path(__file__).resolve().parents[1] / "data")
        entry = self._read("game_data.json")
        if entry.get("content_schema_version") not in {2, 3}:
            raise ValueError("content_schema_version must be 2 or 3")
        self.schema_version = entry.get("content_schema_version", 2)
        self.domains = entry["domains"]
        self.domain_meta = entry.get("domain_meta", {domain: {"name": domain, "short_name": domain} for domain in self.domains})
        self.files = {key: self._read(name) for key, name in entry["content"].items()}
        self.roles = {x["id"]: x for x in self._items(self.files["roles"], "roles")}
        self.sites = {x["id"]: x for x in self._items(self.files["sites"], "sites")}
        self.cards = {x["id"]: x for x in self._items(self.files["culture_cards"], "cards")}
        self.events = {x["id"]: x for x in self._items(self.files["events"], "events")}
        self.tasks = {x["id"]: x for x in self._items(self.files["tasks"], "tasks")}
        self.difficulty = {x["id"]: x for x in self._items(self.files["difficulty"], "difficulty")}
        raw_routes = self._items(self.files["routes"], "routes")
        unique_routes = {}
        for route in raw_routes:
            pair = tuple(sorted((route.get("from"), route.get("to"))))
            if None not in pair and pair not in unique_routes:
                unique_routes[pair] = {**route, "from": pair[0], "to": pair[1], "directional_rules": route.get("directional_rules", {})}
        self.routes = list(unique_routes.values())
        self.regions = self._items(self.files.get("regions", []), "regions")
        self.site_facets = self._items(self.files.get("site_facets", []), "facets")
        self.scenarios = {x["id"]: x for x in self._items(self.files.get("scenarios", []), "scenarios")}
        self.task_templates = self._items(self.files.get("task_templates", []), "task_templates")
        self.projects = {x["id"]: x for x in self._items(self.files.get("projects", []), "projects")}
        self.action_cards = {x["id"]: x for x in self._items(self.files.get("action_cards", []), "cards")}
        self.event_chains = self._items(self.files.get("event_chains", []), "event_chains")
        self.role_upgrades = {x["id"]: x for x in self._items(self.files.get("role_upgrades", []), "role_upgrades")}
        self.objectives = {x["id"]: x for x in self._items(self.files.get("objectives", []), "objectives")}
        self.achievements = self._items(self.files.get("achievements", []), "achievements")
        self.terminology = self.files.get("terminology", {})
        validate_content_mechanisms(self.files)
        for index, route in enumerate(self.routes):
            route.setdefault("id", f"route_{route['from']}_{route['to']}_{index}")
            route.setdefault("status", "open")
            route.setdefault("risk", 0)
            route.setdefault("connection_level", 0)
            route.setdefault("active_project_id", None)
            route.setdefault("tags", [])
            route.setdefault("waypoints", [])
            if len(route["waypoints"]) == 2 and all(isinstance(value, (int, float)) for value in route["waypoints"]):
                route["waypoints"] = [route["waypoints"]]
            route.setdefault("roadClass", "main" if "main" in route.get("tags", []) else "local")
            route.setdefault("terrain", "valley" if "gate" in route.get("tags", []) else "plain")
            route.setdefault("labelPosition", None)
            route.setdefault("event_tags", [])
        for site in self.sites.values():
            tags = set(site.get("domains", site.get("site_tags", [])))
            site["domains"] = [domain for domain in self.domains if domain in tags or (domain == "architecture" and tags & {"construction", "craft", "worship"}) or (domain == "statue" and tags & {"buddha", "statue"}) or (domain == "frontier" and tags & {"frontier", "security"}) or (domain == "trade" and tags & {"trade", "exchange", "mobility"})]
        self._validate()

    def _read(self, name):
        return json.loads((self.root / name).read_text(encoding="utf-8-sig"))

    def _items(self, value, key):
        return value if isinstance(value, list) else value.get(key, [])

    def _validate(self):
        known = set(self.sites)
        if any(r["from"] not in known or r["to"] not in known for r in self.routes):
            raise ValueError("route references unknown site")
        if any(t.get("site_id") not in known for t in self.tasks.values()):
            raise ValueError("task references unknown site")
        if self.schema_version >= 3 and len(self.sites) < 18:
            raise ValueError("phase 2 content requires at least 18 sites")
        for scenario in self.scenarios.values():
            card_pool = scenario.get("card_pool")
            if not isinstance(card_pool, dict) or not card_pool:
                raise ValueError(f"scenario card_pool required: {scenario.get('id')}")
            unknown_cards = set(card_pool) - set(self.cards)
            if unknown_cards:
                raise ValueError(f"scenario card_pool references unknown cards: {scenario.get('id')} {sorted(unknown_cards)}")
            enabled_sites = set(scenario.get("enabled_site_ids", self.sites))
            copies = {card_id: int(amount) for card_id, amount in card_pool.items()}
            for task in self.tasks.values():
                if task.get("site_id") not in enabled_sites:
                    continue
                if sum(copies.values()) < int(task.get("required_card_count", 0)):
                    raise ValueError(f"scenario task lacks cards: {scenario.get('id')} {task.get('id')}")
                available = [self.cards[card_id] for card_id in copies for _ in range(copies[card_id])]
                domains = {card.get("domain") for card in available}
                origins = {origin for card in available for origin in card.get("origin_tags", [])}
                combos = {tag for card in available for tag in card.get("combo_tags", [])}
                if not set(task.get("required_domains", [])).issubset(domains):
                    raise ValueError(f"scenario task lacks domain: {scenario.get('id')} {task.get('id')}")
                if len(origins) < int(task.get("required_origin_diversity", 0)):
                    raise ValueError(f"scenario task lacks origins: {scenario.get('id')} {task.get('id')}")
                requirement = task.get("combo_requirement", {})
                if not set(requirement.get("required_combo_tags", [])).issubset(combos):
                    raise ValueError(f"scenario task lacks combo: {scenario.get('id')} {task.get('id')}")

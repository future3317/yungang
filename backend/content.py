import json
from pathlib import Path

class Content:
    def __init__(self, root=None):
        self.root = Path(root or Path(__file__).resolve().parents[1] / "data")
        entry = self._read("game_data.json")
        if entry.get("content_schema_version") != 2:
            raise ValueError("content_schema_version must be 2")
        self.domains = entry["domains"]
        self.domain_meta = entry.get("domain_meta", {domain: {"name": domain, "short_name": domain} for domain in self.domains})
        self.files = {key: self._read(name) for key, name in entry["content"].items()}
        self.roles = {x["id"]: x for x in self._items(self.files["roles"], "roles")}
        self.sites = {x["id"]: x for x in self._items(self.files["sites"], "sites")}
        self.cards = {x["id"]: x for x in self._items(self.files["culture_cards"], "cards")}
        self.events = {x["id"]: x for x in self._items(self.files["events"], "events")}
        self.tasks = {x["id"]: x for x in self._items(self.files["tasks"], "tasks")}
        self.difficulty = {x["id"]: x for x in self._items(self.files["difficulty"], "difficulty")}
        self.routes = self._items(self.files["routes"], "routes")
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

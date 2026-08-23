import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data"


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def save(name, data):
    (ROOT / name).write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_sites(sites):
    for site in sites:
        # documented sites must be hexagon and cite sources
        if site.get("content_class") == "documented":
            site["map_shape"] = "hexagon"
        # interpretive sites use circle/triangle and may cite sources
        elif site.get("content_class") == "interpretive":
            site["map_shape"] = "circle"
            # pingcheng_ruins is interpretive but based on real archaeology
            if site["id"] == "pingcheng_ruins" and not site.get("source_ids"):
                site["source_ids"] = ["source_pingcheng_northern_wei"]
        # gameplay facilities use square/diamond; avoid hexagon so they do
        # not visually read as real heritage
        elif site.get("content_class") == "gameplay":
            current = site.get("map_shape")
            if current == "hexagon":
                site["map_shape"] = "diamond"
        # ensure the three blocks exist
        site.setdefault("historical_context", site.get("summary", ""))
        site.setdefault("gameplay_effect", site.get("node_ability", {}).get("description", ""))
        site.setdefault("strategy_hint", site.get("gameplay_hint", ""))
    return sites


def effect_text(effect):
    mapping = {
        "gain_ap": "恢复行动点",
        "gain_clue": "获得研究点",
        "influence": "增加共同影响",
        "next_contribute_bonus": "下一次贡献获得额外影响",
        "free_move": "下一次移动不额外消耗路线行动点",
        "reduce_weathering": "降低风化压力",
        "restore_and_influence": "补充修护资源并获得影响",
    }
    return mapping.get(effect.get("type"), effect.get("type", ""))


def update_cards(cards):
    documented_ids = {
        "craft",
        "archive",
        "motif",
        "culture_07",
        "culture_11",
        "culture_22",
        "culture_27",
        "culture_30",
        "culture_32",
        "culture_33",
    }
    for card in cards:
        # split the three blocks
        description = card.get("description", "").strip()
        evidence_use = card.get("evidence_use_text", "").strip()
        instant_use = card.get("instant_use_text", "").strip()
        culture_note = card.get("culture_note", "").strip()

        card["historical_context"] = description
        card["gameplay_effect"] = " ".join(part for part in [evidence_use, instant_use] if part)
        card["strategy_hint"] = culture_note

        # promote historically grounded cards that already carry sources
        if card["id"] in documented_ids:
            card["content_class"] = "documented"
            # ensure they retain existing source_ids
            if not card.get("source_ids"):
                raise ValueError(f"documented card missing source_ids: {card['id']}")
        else:
            card["content_class"] = "gameplay"
            card.pop("source_ids", None)
    return cards


def update_sources(sources):
    existing_ids = {s["id"] for s in sources}
    if "source_pingcheng_northern_wei" not in existing_ids:
        sources.append({
            "id": "source_pingcheng_northern_wei",
            "title": "山西省考古研究所：《大同南郊北魏墓群》，科学出版社，2006年",
            "url_or_citation": "ISBN 978-7-03-016529-4"
        })
    return sources


def main():
    sites = load("sites.json")
    save("sites.json", update_sites(sites))

    culture_cards = load("culture_cards.json")
    culture_cards["cards"] = update_cards(culture_cards["cards"])
    save("culture_cards.json", culture_cards)

    sources = load("sources.json")
    sources["sources"] = update_sources(sources["sources"])
    save("sources.json", sources)

    print("Content structure cleanup complete.")


if __name__ == "__main__":
    main()

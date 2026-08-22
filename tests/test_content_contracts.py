import pytest

from backend.content_schemas import validate_content_contracts


def _files(scenario, *, tasks=None, cards=None):
    return {
        "sites": [{"id": "site-1", "name": "节点", "content_class": "gameplay", "x": 10, "y": 10}],
        "culture_cards": cards or [{"id": "card-1", "name": "证据", "content_class": "gameplay", "domain": "architecture", "description": "证据", "icon_asset": "card.webp", "origin_tags": ["中原"], "combo_tags": ["archive_context"]}],
        "scenarios": [scenario],
        "tasks": tasks or [],
    }


def _scenario(**overrides):
    return {"id": "scenario-1", "name": "场景", "content_class": "gameplay", "enabled_site_ids": ["site-1"], "card_pool": {"card-1": 1}, **overrides}


def test_scenario_references_are_checked_against_content_ids():
    with pytest.raises(ValueError, match="scenario references unknown site"):
        validate_content_contracts(_files(_scenario(enabled_site_ids=["missing-site"])))


def test_enabled_task_must_have_domains_sources_and_combos_in_its_pool():
    task = {"id": "task-1", "name": "任务", "content_class": "gameplay", "site_id": "site-1", "required_domains": ["architecture"], "required_origin_diversity": 2, "required_card_count": 1, "combo_requirement": {"required_combo_tags": ["archive_context"]}}
    with pytest.raises(ValueError, match="insufficient source diversity"):
        validate_content_contracts(_files(_scenario(), tasks=[task]))

import pytest
from pydantic import ValidationError

from backend.content_schemas import ComboRequirementContract, EventContract, ProjectStageContract


def test_combo_requirement_contract_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        ComboRequirementContract.model_validate({"required_combo_tags": [], "unexpected": True})


def test_project_stage_contract_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        ProjectStageContract.model_validate({
            "id": "discover",
            "name": "定位线索",
            "action_type": "explore",
            "unexpected": "not part of the stage contract",
        })


def test_event_contract_has_one_mitigation_hint_field():
    assert list(EventContract.model_fields).count("mitigation_hint") == 1

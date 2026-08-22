import pytest
from pydantic import ValidationError

from backend.content_schemas import ComboRequirementContract, EventContract, ProjectStageContract
from backend.models import EventForecastScope, EventInstance, EventRecord, PendingChoice, PendingChoiceOption, ProjectStage, RoundEntityChange, RoundMetrics, RoundSummary, TaskState


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


@pytest.mark.parametrize("model, payload", [
    (EventForecastScope, {}),
    (EventRecord, {}),
    (EventInstance, {}),
    (PendingChoiceOption, {"id": "option"}),
    (PendingChoice, {"kind": "discard"}),
    (RoundMetrics, {}),
    (RoundEntityChange, {}),
    (RoundSummary, {}),
    (ProjectStage, {}),
    (TaskState, {}),
])
def test_runtime_contracts_reject_unknown_fields(model, payload):
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "unexpected_field": True})

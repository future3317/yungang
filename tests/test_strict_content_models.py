import pytest
from pydantic import TypeAdapter, ValidationError

from backend.content_schemas import (
    ComboRequirementContract,
    EffectContract,
    EventContract,
    ProjectStageContract,
)
from backend.models import (
    EffectiveRules,
    EventForecastScope,
    EventInstance,
    EventModifier,
    EventRecord,
    PendingChoice,
    PendingChoiceOption,
    ProjectStage,
    RoundEntityChange,
    RoundMetrics,
    RoundSummary,
    StageEvidence,
    StageRequirements,
    StageReward,
    TaskReward,
    TaskState,
)


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


def test_effect_contract_uses_closed_discriminated_shapes():
    adapter = TypeAdapter(EffectContract)
    assert adapter.validate_python({"type": "survey_route", "risk_delta": -1, "clues": 1}).type == "survey_route"
    with pytest.raises(ValidationError):
        adapter.validate_python({"type": "survey_route", "amount": 1})
    with pytest.raises(ValidationError):
        adapter.validate_python({"type": "not_a_runtime_effect", "amount": 1})


def test_task_runtime_submodels_reject_unknown_nested_fields():
    with pytest.raises(ValidationError):
        TaskState.model_validate({"interpretation": {"placements": [{"card_id": "survey", "relation": "support", "unexpected": True}]}})


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
    (EventModifier, {"type": "route_action_cost"}),
    (StageEvidence, {"stage_id": "discover", "card_id": "card", "player_id": "p1", "action_type": "explore"}),
    (StageRequirements, {}),
    (StageReward, {}),
    (TaskReward, {}),
    (EffectiveRules, {}),
])
def test_runtime_contracts_reject_unknown_fields(model, payload):
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "unexpected_field": True})

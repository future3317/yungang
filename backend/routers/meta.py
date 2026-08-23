from fastapi import APIRouter, HTTPException

from backend.dependencies import content, engine, repo
from backend.models import MetaResponse

router = APIRouter()


@router.get("/healthz", include_in_schema=False)
def healthz():
    try:
        repo.database.ping()
    except Exception as exc:
        raise HTTPException(503, {"code": "database_unavailable", "message": "存档数据库暂时不可用。", "details": {}, "recovery": "retry"}) from exc
    return {"status": "ok", "service": "yungang-heritage-network", "database": repo.database.kind}


@router.get("/api/meta", response_model=MetaResponse)
def meta():
    rules_preview = {}
    for scenario_id, scenario in content.scenarios.items():
        for difficulty_id, difficulty in content.difficulty.items():
            for play_mode in ("solo", "local", "multi_device"):
                key = f"{scenario_id}:{difficulty_id}:{play_mode}"
                rules_preview[key] = {
                    **engine._effective_rules(scenario, difficulty, play_mode == "solo"),
                    "scenario_id": scenario_id,
                    "difficulty_id": difficulty_id,
                    "play_mode": play_mode,
                }
    return MetaResponse(
        schema_version=3,
        mode="heritage_network",
        domains=content.domains,
        domain_meta=content.domain_meta,
        terminology=content.terminology,
        regions=content.regions,
        scenarios=list(content.scenarios.values()),
        roles=list(content.roles.values()),
        sites=list(content.sites.values()),
        facets=content.site_facets,
        cards=list(content.cards.values()),
        action_cards=list(content.action_cards.values()),
        events=list(content.events.values()),
        tasks=list(content.tasks.values()),
        projects=list(content.projects.values()),
        objectives=list(content.objectives.values()),
        difficulty=list(content.difficulty.values()),
        effective_rules_preview=rules_preview,
    )

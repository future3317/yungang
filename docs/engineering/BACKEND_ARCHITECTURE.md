# Backend architecture

The current synchronous FastAPI service remains intentionally small: `app.py` is the HTTP boundary, `content.py` loads JSON, `engine.py` owns rules, and `repository.py` owns SQLite snapshots. This is appropriate for the current scale.

The action and state boundary now exposes `ActionType`, `SiteStatus` and `GameOutcome` enums in Pydantic models. Content validation is available through `scripts/validate_content.py`. A future scale-up can split routers, domain services and SQLAlchemy persistence without moving rules into the browser.

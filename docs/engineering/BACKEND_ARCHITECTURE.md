# Backend architecture

The current synchronous FastAPI service remains intentionally small: `app.py` is the HTTP boundary, `content.py` loads JSON, `engine.py` owns rules, and `repository.py` owns database snapshots. The storage adapter uses a psycopg connection pool for PostgreSQL and the standard SQLite connection path for local development and isolated tests. Production selects PostgreSQL through `DATABASE_URL` and must not fall back to SQLite.

The action and state boundary now exposes `ActionType`, `SiteStatus` and `GameOutcome` enums in Pydantic models. Content validation is available through `scripts/validate_content.py`; schema and index initialization are idempotent and do not import or overwrite the production database during application startup. A future scale-up can split routers, domain services and SQLAlchemy persistence without moving rules into the browser.

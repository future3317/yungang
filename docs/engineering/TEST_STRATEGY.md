# Test strategy

- Content: `conda run -n piepaper python scripts/validate_content.py`.
- Backend regression: `conda run -n piepaper pytest -q tests/test_api.py`.
- Frontend type/build: `npm run typecheck` and `npm run build`.
- Visual audit: start FastAPI, then run `conda run -n piepaper python scripts/audit_screenshots.py`.
- Full browser/a11y flow: `npm run test:ui` after installing Playwright browsers.

The screenshot script covers 1920x1080, 1440x900, 1280x800, 768x1024 and 390x844. It selects the current runtime DOM rather than retired selectors.

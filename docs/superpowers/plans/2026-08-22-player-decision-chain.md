# 玩家决策链 P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the visible game loop answer four questions with one source of truth: how to win, what is changing, what an action will do, and what the player should do next.

**Architecture:** The backend remains the authority for effective rules, interpretation requirements, action legality, preview deltas, and feedback changes. The frontend renders those structured results and owns only transient dialog/tutorial state. Existing deep-green HUD and current component boundaries remain; no parallel engine or second layout system is introduced in this phase.

**Tech Stack:** FastAPI, Pydantic, Python engine, React, TypeScript, TanStack Query, Vitest, pytest, Playwright.

**Spec:** `C:/Users/LRH/.codex/attachments/0e356339-7418-43be-ad9e-6bfc2316dddb/pasted-text.txt`

## Global Constraints

- Keep Chinese player-facing copy; never render internal IDs, `target_rule`, or effect keys directly.
- Keep `weathering_track` as the displayed pressure field and do not add another compatibility path.
- Use one backend result for legality, preview, execution feedback, and UI progress.
- Keep the existing deep-green, warm-stone, gold visual system.
- Run `npm run test`, `npm run build`, `python -m pytest -q`, and the relevant Playwright suite before committing.

---

### Task 1: Effective rules and landing facts

**Files:**
- Modify: `backend/engine.py`
- Modify: `backend/app.py`
- Modify: `frontend/src/shared/api/generated.ts`
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/pages/landing/LandingPage.tsx`
- Test: `tests/test_api.py`
- Test: `frontend/src/pages/landing/LandingPage.test.tsx`

**Interfaces:**
- Produces `effective_rules_preview(scenario_id, difficulty_id, play_mode)` in the metadata contract.
- Produces typed `victory_conditions[]` and `failure_conditions[]` in game state.

- [ ] Add the backend preview response using the same scenario, difficulty, and solo calculation used by `new_game`.
- [ ] Return normalized minute ranges without a duplicate unit suffix and render the unit exactly once.
- [ ] Return condition objects with `kind`, `operator`, `current`, `target`, `status`, `label`, and `remaining`.
- [ ] Render concrete scenario victory/failure/core-mechanic information and the effective difficulty result on the landing page.
- [ ] Add API and component assertions for the effective rule values and normalized duration.

### Task 2: Tutorial progress and first-intent guidance

**Files:**
- Modify: `frontend/src/pages/game/GamePage.tsx`
- Modify: `frontend/src/widgets/game/TutorialGuide.tsx`
- Modify: `frontend/src/shared/useTutorialProgress.ts`
- Test: `frontend/src/pages/game/GamePage.test.tsx`
- Test: `frontend/src/widgets/game/TutorialGuide.test.tsx`

**Interfaces:**
- `useTutorialProgress()` is the only owner of tutorial progress.
- `TutorialGuide` receives progress and an intent event instead of creating another hook instance.

- [ ] Remove the legacy `sessionStorage` auto-open effect and use the existing local-storage progress state.
- [ ] Trigger movement, market, interpretation, strategy-card, and event guidance when the player first intends to enter each flow.
- [ ] Trigger event guidance from the first `current_event_id`, including events that auto-resolve without a resolve action.
- [ ] Keep the manual “怎么玩” entry point independent from contextual completion markers.
- [ ] Assert that guidance appears before the first action is submitted and that progress persists after reload.

### Task 3: Single interpretation evaluator

**Files:**
- Modify: `backend/engine.py`
- Modify: `backend/models.py`
- Modify: `frontend/src/widgets/game/SiteInspector.tsx`
- Modify: `frontend/src/widgets/game/TaskCompleteDialog.tsx`
- Test: `tests/test_release_mechanics.py`
- Test: `tests/test_release_gaps.py`

**Interfaces:**
- `_evaluate_interpretation(task)` returns `requirements`, `missing_domains`, `missing_origins`, `missing_tags`, `confidence`, and `can_form`.
- `task.progress.interpretation` and legality consume the same evaluator output.

- [ ] Make support contribute +2 confidence, pending contribute +0, and conflict contribute -1.
- [ ] Use evaluator requirements for both progress rendering and form-interpretation legality.
- [ ] Ensure an interpretation with conflict evidence cannot show all requirements complete while remaining illegal.
- [ ] Return a backend preview for each intervention and preserve its result changes for completion UI.
- [ ] Add before/after tests for confidence, requirements, and all three intervention outcomes.

### Task 4: Real action simulation and target display

**Files:**
- Modify: `backend/engine.py`
- Modify: `backend/models.py`
- Modify: `frontend/src/widgets/game/ActionPreview.tsx`
- Modify: `frontend/src/pages/game/GamePage.tsx`
- Test: `tests/test_release_mechanics.py`
- Test: `frontend/src/widgets/game/ActionPreview.test.tsx`

**Interfaces:**
- `simulate_action(state, request)` clones the state, runs the same action handler, diffs structured state changes, and discards the clone.
- `ActionOption.preview_delta` is derived from `simulate_action`, not a handwritten action-type table.

- [ ] Move preview construction behind the simulator while preserving current legality checks.
- [ ] Report AP, pressure, clues, restoration, route risk/status, site damage/status, and project changes as structured deltas.
- [ ] Display location targets separately from evidence relation, intervention mode, player, and route targets.
- [ ] Show the exact preview for event response choices and strategy-card actions.
- [ ] Add tests proving repair discounts/free costs and interpretation/connection deltas match execution.

### Task 5: P0 verification and integration

**Files:**
- Modify: `frontend/e2e/game.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/engineering/FRONTEND_ARCHITECTURE.md`

- [ ] Add one deterministic desktop journey from scenario selection through interpretation, intervention, strategy card, round end, and round summary.
- [ ] Assert the victory list, effective rules, preview changes, and event result are visible in that journey.
- [ ] Run the required test, build, and Playwright commands in sequence with the project environment.
- [ ] Commit only source, tests, and required documentation; leave `output/`, `tmp/`, and `yungang_game_ui_assets/` untracked.
- [ ] Push the verified commit to `origin/main`.


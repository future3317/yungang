# Piepaper Maintainer Skill

## Description

Code health and architecture compliance auditor for the Piepaper project. Scans the codebase against AGENTS.md invariants to detect potentially dead code, duplicate logic, architecture drift, and legacy artifacts. Prioritizes investigation over presumption. Never introduces new agents, builders, or frameworks.

## Invocation

```
/maintain
```

When invoked, this skill automatically executes the full 6-phase audit below. No additional user input is required.

---

## Phase 0: Repository Evolution Audit

Before analyzing code, understand how the repository has evolved. This prevents stale assumptions and identifies modules whose history explains their current shape.

### 0.1 Recent Modification Hotspots

Run:

```bash
git log --since="30 days ago" --pretty=format: --name-only | grep -v '^$' | sort | uniq -c | sort -rg | head -20
```

Report: files with the most commits in the last 30 days. These are active development zones — prioritize them for drift detection.

### 0.2 Long-Unmodified Modules

Run:

```bash
git log --format="%H %ad" --date=short --name-only --diff-filter=A -- src/ | awk '/^[0-9a-f]{40}/ {commit=$1; date=$2} /^src\// {print date, commit, $0}' | sort
```

Cross-reference with:

```bash
git log --format="%ad %H" --date=short --name-only --diff-filter=M -- src/ | awk '/^[0-9]{4}-[0-9]{2}-[0-9]{2}/ {date=$1; commit=$2} /^src\// {print date, commit, $0}' | sort -k3,3 | awk '{f=$3; if(f!=prev){print $0; prev=f}}'
```

Report: files in `src/` whose last modification is older than 90 days. Flag any that also appear in the current import graph — they may be stable utilities or forgotten dependencies.

### 0.3 Patch-Introduced Modules

Run:

```bash
git log --all --oneline --grep="Patch [0-9]" | head -30
```

For each patch commit, extract added files:

```bash
git show --stat --format=oneline <commit>
```

Report: which modules were introduced by which patch. If a patch-introduced module has zero modifications since its introduction, flag it as potentially abandoned.

### 0.4 Patch-Deprecated Modules

Search commit messages for deprecation signals:

```bash
git log --all --oneline --grep="deprecat" --grep="orphan" --grep="dead" --grep="remove" --grep="delete" --grep="superseded" --grep="replaced"
```

Report: modules that were explicitly deprecated in commit messages. Cross-check whether they still exist in HEAD.

### 0.5 Git Island Code

Run for each Python file in `src/`:

```bash
git log --follow --oneline -- <file> | wc -l
```

Files with exactly 1 commit (their initial addition) and no subsequent modifications are "git islands." Cross-reference with current imports. If unimported, flag as potentially dead.

### 0.6 Frequently Rolled-Back Modules

Run:

```bash
git log --all --oneline --grep="Revert" | head -20
```

For each revert, identify the affected files and report: modules that have been reverted multiple times may indicate unstable design or disputed boundaries.

---

## Phase 1: Architecture Compliance Audit

Verify code against AGENTS.md hard rules. For each violation found, emit:

```
[VIOLATION] file.py:line — rule_id — description — severity
```

### Checklist (auto-executed)

| # | Rule | Check |
|---|------|-------|
| 1 | No fallback extractor | Verify `src/extract/extractor.py` (RecordExtractor) is not imported by canonical pipeline |
| 2 | No schema relaxation | Verify Pydantic v2 enforcement in `extraction_schema.py`; no `Config.extra = "ignore"` |
| 3 | No evidence binding bypass | Verify no code falls back to `evidence_blocks[0]` |
| 4 | No raw LLM leakage | Verify `ExtractionProvenance.sanitize_config` strips secrets; verify no `raw_response` in materialized records |
| 5 | No provider default changes | Verify `deepseek` remains default in `llm_client.py` |
| 6 | No framework lock-in | Verify agents remain plain Python; no CrewAI, LangChain, or AutoGen imports |
| 7 | Orchestrator-owned commits | Verify no agent calls `store.commit()` directly |
| 8 | Proposal-only artifacts | Verify proposal bundles carry `publication_status="not_published"` |
| 9 | No compiled evidence as authoritative | Verify `CompiledEvidenceContext` includes ADVISORY warning |
| 10 | No legacy F1 as sole metric | Verify benchmark scripts report `loose_property_f1`, not legacy `property_f1` |
| 11 | No cell-level fabrication | Verify `table_cell_ref` is derived from `parsed_table`, not inferred |
| 12 | No table parsing as authoritative | Verify `parsed_table` is not used for direct extraction |
| 13 | No DomainPack auto-apply | Verify patch candidate CLIs write to `--output-dir`, never mutate `domains/*/domain.json` |
| 14 | No skeleton domain claims | Verify thermoelectric domain.json status is `skeleton` |
| 15 | PGCE: single canonical constraint source | Verify `ConstraintPlan` is the run-level source; no second allowed/blocked inference path |
| 16 | PGCE: builder purity | Verify `MaterializedBuilder` and `AggregationPrepBuilder` do not re-run validation or infer material family |
| 17 | No duplicated conflict math | Verify `compute_relative_range` and `compute_rsd` are in `verify/conflicts/math.py` |
| 18 | No duplicate parser without checking | Verify new parsers check `table_parsing.py`, `table_extract.py`, `table_provenance.py` |

---

## Phase 2: Dead Code Detection

**Critical principle: Never assume a module or function is dead based on prior audits.**

Every invocation of this skill must perform a fresh repository scan. A module that was unreferenced last month may have gained callers today. A function that had no tests yesterday may have tests today.

### Mandatory Fresh Verification Steps

Before reporting any code as dead, orphaned, or deprecated, verify all of the following:

1. **Static import graph**: Search for `from <module>` and `import <module>` across all `.py` files (excluding the module's own test file).
2. **Dynamic loading**: Check for `importlib.import_module`, `__import__`, `pkgutil.iter_modules`, or plugin registries that may load the module dynamically.
3. **Test references**: Search `tests/` and `benchmarks/` for imports, string references, or pytest fixture usage.
4. **CLI / script references**: Check `scripts/` and CLI entry points for imports or subprocess calls.
5. **Config references**: Check `pyproject.toml`, `setup.py`, `tox.ini`, `.github/workflows/`, and domain JSON files for string references to the module or its functions.
6. **Documentation references**: Check `docs/`, `README.md`, and `AGENTS.md` for mentions that imply active usage.
7. **Git recency**: Check `git log -1 --format="%ci" -- <file>` — recently modified code is less likely to be dead.

### Classification Rules

| Condition | Classification |
|-----------|---------------|
| Zero static imports, zero dynamic loads, zero tests, zero CLI usage, zero config refs, zero docs refs, not modified in 90+ days | **Potentially dead** — recommend deletion with evidence |
| Zero static imports, but present in tests or documentation | **Test-only / docs-only** — flag for review, do not delete |
| Zero static imports, but present in `scripts/` or dynamic loading | **Dynamically loaded** — flag for review, do not delete |
| Imported only by deprecated modules | **Cascade candidate** — review the importer first |
| Explicitly marked deprecated in docstring or code comment | **Deprecated** — check deprecation timeline before action |
| Any ambiguity in the above checks | **Requires manual review** — report findings, recommend human confirmation |

### 2.1 Unreferenced Modules

Scan for modules with zero imports outside their own test file. Report each with:

- Classification (per rules above)
- Evidence from the 7 verification steps
- Recommended action (delete / archive / review / keep)

### 2.2 Unreferenced Functions / Methods

For each candidate function or method:

1. Run `grep -r "function_name(" --include="*.py"`
2. Check test files for `mock.patch` string references
3. Check if the function is a public API that external consumers might call
4. Report only if all checks confirm zero usage

### 2.3 Deprecated Scripts

For scripts in `scripts/`:

1. Check for `DeprecationWarning`, `warnings.warn("deprecated"`, or docstring deprecation notices
2. Check `git log --oneline --grep="deprecat" -- <script>` for deprecation commits
3. Check if a replacement script exists and is actively used
4. Verify no CI workflow, documentation, or operational runbook references the script
5. Classify: **Safe to delete** (only if all 4 conditions above pass) / **Archive candidate** / **Keep**

### 2.4 Debug Archive

`scripts/debug_archive/` contains scripts explicitly documented as "NOT production code" and "NOT run in CI."

Before recommending any action on debug archive scripts:

1. Check git history: `git log --oneline -- <script>` — has it been modified recently?
2. Check for recovery references: grep the entire repo for the script's basename
3. Check documentation: is it referenced in any runbook, benchmark guide, or data migration note?
4. Check if it contains unique data transformation logic not present elsewhere

Classification:

| Condition | Classification |
|-----------|---------------|
| No git history in 90+ days, no repo references, no docs, no unique logic | **Archive candidate** |
| Referenced in docs, runbooks, or benchmarks | **Keep** |
| Contains unique data migration or transformation logic | **Keep or extract to scripts/util/** |
| Any ambiguity | **Requires manual review** |

### 2.5 Legacy Compatibility Layers

For compatibility bridges and fallback code:

1. Check if the "legacy" path they bridge to is still reachable
2. Check if the "modern" path they bridge from is still in use
3. If both ends are dead, the bridge is dead
4. If either end is alive, flag the bridge as **technical debt** rather than dead code

---

## Phase 3: Duplicate Logic Detection

### 3.1 Duplicate Agents / Roles

Search `src/orchestration/roles.py` for thin adapter classes that wrap functional agents. Report:

- Adapter name
- Wrapped agent
- Lines of code in adapter
- Whether the adapter adds orchestration-specific behavior or is pure pass-through

**Verdict guidance:** Per AGENTS.md, thin orchestration adapters are an intentional pattern. Do not flag them as bugs. Only flag if an adapter has drifted from its wrapped agent's interface (e.g., missing new parameters, wrong return type).

### 3.2 Duplicate Builders

Search for duplicated patterns across builders:

- `_normalize_unit` or similar unit normalization
- ID hashing / deterministic ID generation
- Value parsing (ranges, scientific notation)
- `_parse_value` or similar numeric extraction

For each pattern found in 2+ files, report:

- Pattern name
- Files where it appears
- Whether an existing shared utility (`src/infra/`, `src/tools/`) could host it
- Recommended action (extract to shared utility / keep duplicated with justification)

### 3.3 Duplicate Validators

Search for validation classes that share logic:

- Schema validation vs. constraint validation
- Range checking vs. unit validation
- Property name normalization

Report overlaps and recommend: extract shared helper / merge classes / keep separate with justification.

### 3.4 Duplicate Evidence Binding

Check for multiple evidence binding implementations:

- `src/extract/evidence_binding.py`
- `src/evidence/binding.py`
- Any other binding-related modules

Report:

- Which is canonical (per AGENTS.md / imports / commit recency)
- Which is legacy (per deprecation markers / import count / git history)
- Whether the legacy version still has active callers
- Recommended action (migrate callers then delete legacy / keep both with justification)

### 3.5 Duplicate Table Quote Building

Search for evidence quote formatting logic in:

- `src/docrep/table_candidates.py`
- `src/docrep/table_provenance.py`
- Any other docrep modules

Report duplicated formatting patterns and recommend consolidation.

### 3.6 Duplicate Numeric Parsing

Search for numeric value extraction in:

- `src/docrep/table_parsing.py`
- `src/publish/observations/numeric_parser.py`
- Any extraction or parsing modules

Report whether one implementation is more structured and should be canonical.

---

## Phase 4: Architecture Drift Detection

### 4.1 Orchestrator Bypass

Search for direct store commits, validation calls, or state mutations outside the orchestrator path. Report:

- Location
- What bypass occurs
- Risk level (high/medium/low)
- Whether the bypass is documented in AGENTS.md

### 4.2 Verification Bypass

Search for validation logic that runs outside `ConstraintValidator` or `ConflictResolutionAgent`. Report:

- Location
- What validation is performed
- Whether it duplicates canonical verification

### 4.3 MaterializationAgent Bypass

Search for materialized record building outside `MaterializationAgent`. Report:

- Location
- Builder used
- Whether the output feeds the canonical observation path

### 4.4 Publication Gate Bypass

Search for `publication_status` assignments outside canonical promotion paths. Verify skeleton domains remain `skeleton` status. Report any anomalies.

---

## Phase 5: Refactoring Opportunities

### Deletion Candidates (High Confidence)

Before classifying any file as a deletion candidate, the following must ALL be true:

1. No imports outside its own test file
2. No test references outside its own test file
3. No CLI or script usage
4. No config references (pyproject.toml, CI, domain JSON)
5. No dynamic loading (`importlib`, plugin registries)
6. No documentation references implying active use
7. Not modified in 90+ days OR explicitly deprecated with a replacement documented
8. No unique data migration or benchmark reproduction logic

If all 8 conditions pass, classify as **Deletion candidate** and report estimated lines removed.

If any condition fails, classify as **Archive candidate** or **Keep** with justification.

### Merge Opportunities (Medium Confidence)

For duplicated patterns identified in Phase 3, report:

- Target pattern
- Action (extract to shared utility / merge implementations)
- Files affected
- Estimated effort
- Risk of breaking existing tests

### Architecture Cleanups (Lower Priority)

For minor cleanups (dead branches, unused parameters, deprecated re-exports), report:

- Location
- Issue
- Effort (low/medium/high)
- Risk

---

## Output Format

When this skill completes, emit the following structured report:

```markdown
# Executive Summary

- Total modules scanned: {N}
- Violations found: {N} (critical: {N}, high: {N}, medium: {N}, low: {N})
- Potentially dead code blocks: {N} (~{N} lines)
- Duplicate implementations: {N} pairs
- Architecture drift instances: {N}
- Deletion candidates: {N} files (~{N} lines)
- Archive candidates: {N} files
- Merge opportunities: {N}

# Repository Evolution (Phase 0)

| Category | Finding | Risk |
|----------|---------|------|

# AGENTS Compliance Issues (Phase 1)

| Severity | File | Line | Rule | Description |
|----------|------|------|------|-------------|

# Dead Code Analysis (Phase 2)

| File | Classification | Evidence | Recommended Action |
|------|---------------|----------|-------------------|

# Duplicate Implementations (Phase 3)

| Pattern | Locations | Canonical | Legacy | Merge Strategy |
|---------|-----------|-----------|--------|----------------|

# Architecture Drift (Phase 4)

| Location | Drift Type | Bypasses | Risk | Documented? |
|----------|------------|----------|------|-------------|

# Refactoring Roadmap (Phase 5)

## Immediate (this sprint)
1. ...

## Short-term (next 2 sprints)
1. ...

## Long-term (next quarter)
1. ...
```

---

## Principles

1. **Verify first, classify second.** Every invocation performs a fresh scan. Never assume a prior audit's findings still hold.
2. **Never add abstraction to solve duplication.** Merge or delete; do not extract a new base class unless explicitly requested.
3. **Never add a new agent, builder, or framework.** The canonical agent set is fixed.
4. **Preserve backward compatibility only when explicitly documented.** Undocumented legacy paths are bugs.
5. **When in doubt, report and stop.** Do not refactor without user approval.
6. **Respect patch history.** Patch-specific scripts and debug tools served their purpose; archive or delete them, do not maintain them. But never delete without verifying no recovery or reproduction use exists.
7. **Delete only when all preconditions pass.** Before recommending deletion, confirm: no imports, no tests, no CLI usage, no config reference, no dynamic loading, no documented recovery use. If any ambiguity exists, classify as **Archive candidate** and recommend human review.

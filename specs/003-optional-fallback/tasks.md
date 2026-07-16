---

description: "Task list for feature implementation"
---

# Tasks: fallbackValue opcional na família de generators

**Input**: Design documents from `/specs/003-optional-fallback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/GroundedGenerator.md, contracts/GroundedExtractor.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires behavior tests with a mocked OpenAI client written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md — reuses `src/generators/schema.ts`,
`GroundedEnricher.schema.ts`, `GroundedExtractor.schema.ts` unchanged; changed files
under `src/core/`, `src/generators/`, `tests/unit/core/`, `tests/unit/generators/`.

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since SC-001 requires zero regression on every existing consumer of `fallbackValue`.

- [X] T001 Run the full existing test suite (`npm test`) and record it passing (68/68 from features 001+002) as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Relax `fallbackValue` from required to optional in the shared base — every user story's guard logic (`hasFallback`/`shouldFallback`) depends on this.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

### Tests for Foundational ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] Unit test in `tests/unit/core/GroundedCall.test.ts`: `new TestableGroundedCall({} as GroundedCallConfig)` (no `fallbackValue`) does NOT throw
- [X] T003 [P] Unit test in `tests/unit/core/GroundedCall.test.ts`: `new TestableGroundedCall({ fallbackValue: "" })` still throws (explicit empty string remains invalid, FR-002) — this test already exists; confirm it keeps passing after T004

### Implementation for Foundational

- [X] T004 Change `GroundedCallConfig.fallbackValue` from `TFallback` to `TFallback?` (optional) in `src/core/types.ts` (depends on T002, T003)
- [X] T005 Change `GroundedCall.fallbackValue` field to `protected readonly fallbackValue?: TFallback` and relax the constructor validation in `src/core/GroundedCall.ts` — from "throws if `undefined`/`null`/empty-string" to "throws only if `null` or empty-string; `undefined` is accepted" (depends on T004)

**Checkpoint**: `GroundedCallConfig`/`GroundedCall` accept an omitted `fallbackValue`; all three components can now be constructed without it. Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Gerar uma resposta mesmo sem contexto suficiente, sem configurar um fallback fixo (Priority: P1) 🎯 MVP

**Goal**: `GroundedGenerator`, when constructed without `fallbackValue`, always lets the model produce a real best-effort answer — even with insufficient or empty/blank context — instead of a canned fallback string.

**Independent Test**: Construct `GroundedGenerator` without `fallbackValue`; call it with insufficient context and separately with empty/blank context; verify in both cases the model is called and its own answer is returned, with `usedFallback = false`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T006 [P] [US1] Unit test in `tests/unit/generators/GroundedGenerator.test.ts`: `GroundedGenerator` constructed without `fallbackValue`, mocked response with `sufficient_context: false` and a non-empty `final_answer` → asserts `usedFallback = false`, `finalAnswer` equals the model's answer, and `result.extractedFacts`/`result.reasoning` equal the mocked `extracted_facts`/`reasoning` unchanged (FR-003, FR-005)
- [X] T007 [US1] Unit test in `tests/unit/generators/GroundedGenerator.test.ts`: same construction without `fallbackValue`, called with `context: "   "` (blank) → asserts the mocked client IS called (unlike the fallback-configured case) and `finalAnswer` equals the model's answer (FR-004) (depends on T006)
- [X] T008 [US1] Unit test in `tests/unit/generators/GroundedGenerator.test.ts`: without `fallbackValue`, asserts the system message sent to the model contains the no-fallback step-4 instruction text ("Never leave final_answer empty") (depends on T006)
- [X] T009 [US1] Unit test in `tests/unit/generators/GroundedGenerator.test.ts`: without `fallbackValue`, mocked response with `sufficient_context: true` → asserts `usedFallback = false` and `finalAnswer` derived from the extracted facts, same as the fallback-configured happy path (depends on T006)

### Implementation for User Story 1

- [X] T010 [US1] Split the `GroundedGenerator` system prompt in `src/generators/GroundedGenerator.ts` into `BASE_SYSTEM_PROMPT`, `WITH_FALLBACK_STEP_4`, `WITHOUT_FALLBACK_STEP_4`, and `CLOSING_INSTRUCTIONS` constants, plus a `buildSystemPromptBase(hasFallback: boolean): string` helper that composes them (depends on T005)
- [X] T011 [US1] In `generate()` (`src/generators/GroundedGenerator.ts`), compute `const hasFallback = this.fallbackValue !== undefined;` and use it to guard the empty/blank-`context` short-circuit — only short-circuit to the fallback result when `hasFallback` is true; otherwise proceed to call the model (depends on T010)
- [X] T012 [US1] Wire `buildSystemPromptBase(hasFallback)` into the `this.buildSystemPrompt(...)` call in `generate()` (`src/generators/GroundedGenerator.ts`) (depends on T010)
- [X] T013 [US1] Guard the post-call fallback-substitution branch in `generate()` (`src/generators/GroundedGenerator.ts`): only return `this.buildFallbackResult(...)` when `hasFallback` is true; otherwise fall through to returning `output.final_answer` directly with `usedFallback: false` (depends on T011, T012)
- [X] T014 [US1] Update `buildFallbackResult` in `src/generators/GroundedGenerator.ts` to read `this.fallbackValue as string` (safe cast — only ever called when `hasFallback` is true) (depends on T013)

**Checkpoint**: User Story 1 is fully functional and testable independently — `GroundedGenerator` always answers, with or without `fallbackValue`.

---

## Phase 4: User Story 3 - Extrair dados estruturados sem um objeto de fallback fixo (Priority: P2)

**Goal**: `GroundedExtractor`, when constructed without `fallbackValue`, always returns the model's raw extraction (`null` for missing fields), ignoring `strict`, instead of substituting a fallback object — and never calls the model for an empty/blank message.

**Independent Test**: Construct `GroundedExtractor` without `fallbackValue` (with and without `strict: true`); call it with messages that extract nothing, partially, and fully; verify it always returns the extracted data with `null` in missing fields and `usedFallback = false`, never throwing.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T015 [P] [US3] Unit test in `tests/unit/generators/GroundedExtractor.test.ts`: `new GroundedExtractor({ fields })` (no `fallbackValue`) does NOT throw
- [X] T016 [US3] Unit test in `tests/unit/generators/GroundedExtractor.test.ts`: constructed without `fallbackValue`, mocked response with every field `null` → asserts `data` equals an all-`null` object and `usedFallback = false`, no error thrown (FR-009) (depends on T015)
- [X] T017 [US3] Unit test in `tests/unit/generators/GroundedExtractor.test.ts`: constructed without `fallbackValue` and `strict: true`, mocked response with partial fields → asserts `strict` is ignored: `data` contains the extracted fields plus `null` for the rest, `usedFallback = false` (FR-009) (depends on T015)
- [X] T018 [US3] Unit test in `tests/unit/generators/GroundedExtractor.test.ts`: constructed without `fallbackValue`, called with `message: "   "` (blank) → asserts `data` equals an all-`null` object, `usedFallback = false`, and the mocked client is NOT called (FR-011) (depends on T015)

### Implementation for User Story 3

- [X] T019 [US3] Change `GroundedExtractionConfig.fallbackValue` from required to optional (`fallbackValue?: ExtractionData<Fields>`) in `src/generators/GroundedExtractor.ts` (depends on T005)
- [X] T020 [US3] Add a private `buildEmptyData(): ExtractionData<Fields>` method to `GroundedExtractor` in `src/generators/GroundedExtractor.ts` that builds an all-`null` object from `Object.keys(this.fields)` (depends on T019)
- [X] T021 [US3] Replace the `allNull`/`someNull` fallback branching in `extract()` (`src/generators/GroundedExtractor.ts`) with `const hasFallback = this.fallbackValue !== undefined; const shouldFallback = hasFallback && (allNull || (someNull && this.strict));` and branch on `shouldFallback` instead of the old unconditional checks (depends on T020)
- [X] T022 [US3] Update `buildFallbackResult` in `src/generators/GroundedExtractor.ts` to branch: return `{ data: this.fallbackValue, usedFallback: true, reasoning }` when `this.fallbackValue !== undefined`, otherwise return `{ data: this.buildEmptyData(), usedFallback: false, reasoning }` — this also fixes the empty/blank-`message` short-circuit at the top of `extract()`, which already delegates to `buildFallbackResult` (depends on T020, T021)

**Checkpoint**: User Stories 1 AND 3 both work independently — `GroundedExtractor` never throws or substitutes a fixed object when no `fallbackValue` is configured.

---

## Phase 5: User Story 2 - Manter o comportamento atual para quem já configura fallbackValue (Priority: P1)

**Goal**: Every existing caller that already configures `fallbackValue` on any of the three components observes exactly the same behavior as before this feature — including `GroundedEnricher`, which needs no code change at all.

**Independent Test**: Run the full pre-existing test suite (features 001+002, `fallbackValue` always configured) unchanged; additionally construct `GroundedEnricher` both with and without `fallbackValue` and confirm identical output in both cases.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (T023 fails today because `fallbackValue` is still required at this point in the codebase's history if run before Phase 2 — since Phase 2 already landed, this task instead confirms the pre-existing suite and the new Enricher case together).

- [X] T023 [P] [US2] Unit test in `tests/unit/generators/GroundedEnricher.test.ts`: `new GroundedEnricher({})` (no `fallbackValue`) does NOT throw
- [X] T024 [US2] Unit test in `tests/unit/generators/GroundedEnricher.test.ts`: `GroundedEnricher` constructed without `fallbackValue`, mocked response with `sufficient_context: false` → asserts `finalAnswer === baseContent` (unchanged) and `usedFallback = true`, identical to the fallback-configured case (FR-008) (depends on T023)

### Implementation for User Story 2

- [X] T025 [US2] No production code change required in `src/generators/GroundedEnricher.ts` — it already never reads `this.fallbackValue` on any path; run T023/T024 to confirm the type relaxation from Phase 2 is sufficient (depends on T004, T005, T023, T024)
- [X] T026 [US2] Run the full pre-existing test suite (`npm test`) and confirm 100% of features 001+002 tests (all with `fallbackValue` configured) still pass unchanged, after Phases 2-4's changes (depends on T014, T022, T025) — 79/79 passing, zero regression

**Checkpoint**: All three user stories are independently functional; the full suite (pre-existing + new) passes with zero regression on any `fallbackValue`-configured path.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation, after all user stories are complete.

- [X] T027 [P] Update `README.md` (both Português and English sections): change "mandatory fallback"/"fallback obrigatório" wording in the shared "Generators" intro to describe `fallbackValue` as optional, and add the bullet list explaining each component's behavior when it's omitted (per plan.md's Summary) (depends on T026)
- [X] T028 [P] Update the `GroundedGenerator` code example's config comment in both README.md language sections to mention `fallbackValue` is optional and link to the "Generators" explanation (depends on T026)
- [X] T029 Run all 6 `quickstart.md` validation scenarios end-to-end against the implementation — all 6 covered by the new/updated test suite (Cenário 1→T026 regression; 2→T006; 3→T007; 4→T017; 5→T018; 6→T024 + pre-existing FR-106 test)
- [X] T030 Build verification: `npm run build` succeeds and `npm test` passes fully (all features 001+002+003 tests) — 79/79 passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — establishes the regression baseline.
- **Foundational (Phase 2)**: Depends on Phase 1. BLOCKS all user stories — every story's guard logic reads `this.fallbackValue !== undefined`, which only exists once `fallbackValue` is optional at the type/constructor level.
- **User Story 1 (Phase 3)**: Depends on Foundational. Touches only `GroundedGenerator.ts` — independent of US3 (different file).
- **User Story 3 (Phase 4)**: Depends on Foundational. Touches only `GroundedExtractor.ts` — independent of US1 (different file).
- **User Story 2 (Phase 5)**: Depends on Foundational, and in practice also depends on US1 and US3 having landed, since its regression check (T026) is only meaningful once every component's fallback-configured path has been touched by this feature.
- **Polish (Phase 6)**: Depends on US1, US2, and US3 all being complete.

### User Story Dependencies

- **US1 (P1)**: Independent of US3 — touches only `src/generators/GroundedGenerator.ts` and its test file.
- **US3 (P2)**: Independent of US1 — touches only `src/generators/GroundedExtractor.ts` and its test file.
- **US2 (P1)**: Touches only `src/generators/GroundedEnricher.ts`'s test file (no production code change) plus a full-suite regression run — sequenced last because its regression check is most meaningful once US1/US3 changes exist.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Type/constructor relaxation (Foundational) before any per-component guard logic.
- Guard logic (`hasFallback`/`shouldFallback`) before the branches that read it.

### Parallel Opportunities

- T002/T003 (Foundational tests) can be written in parallel (same file, but independent assertions — mark [P] since they don't depend on each other's code).
- Once Foundational (Phase 2) is done, US1 (T006-T014) and US3 (T015-T022) can be implemented fully in parallel by different developers (disjoint files).
- T023 (US2 Enricher construction test) can run in parallel with US1/US3 tests, but T026 (full-suite regression) should run last, after US1 and US3 land.
- Polish tasks T027, T028 can run in parallel (same file, disjoint sections — mark [P] since neither blocks the other's edits conceptually, though both touch README.md so apply them as a single coordinated pass if working solo).

---

## Parallel Example: User Story 1 and User Story 3

```bash
# Once Foundational (Phase 2) is done, launch both independent stories together:
Task: "US1 — GroundedGenerator free-answer mode (T006-T014)"
Task: "US3 — GroundedExtractor free-extraction mode (T015-T022)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (`GroundedGenerator` free-answer mode).
4. **STOP and VALIDATE**: run T006-T009 independently; this alone delivers the change the user asked for first.

### Incremental Delivery

1. Setup + Foundational → baseline confirmed, `fallbackValue` relaxed.
2. Add US1 (`GroundedGenerator`) → validate independently → ship.
3. Add US3 (`GroundedExtractor`) → validate independently → ship.
4. Add US2 (retrocompatibilidade, incl. `GroundedEnricher`) → validate zero regression → ship.
5. Polish (README, quickstart, build).

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: US1 (`GroundedGenerator`)
- Developer B: US3 (`GroundedExtractor`)
- Developer C: prepares US2's regression pass, running it once A and B land

---

## Notes

- [P] tasks = different files (or independent assertions in the same new test block), no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- No new configuration flags are introduced anywhere in this feature — every behavior change is driven by `fallbackValue`'s presence/absence (see research.md).

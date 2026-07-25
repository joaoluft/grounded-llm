---

description: "Task list for feature implementation"
---

# Tasks: Structured Logging Hooks

**Input**: Design documents from `/specs/008-structured-logging-hooks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/lifecycle-callbacks.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires the shared wrapper and each generator's callback wiring to have tests written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md. One new file (`src/core/lifecycle-callbacks.ts`);
modifications to `src/core/types.ts`, `src/core/grounded-call.ts`, and all four files
under `src/generators/`, following the kebab-case file naming already established
(feature 005).

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since no existing
component's observable behavior may regress (spec Assumptions, FR-009).

- [X] T001 Run the full existing test suite (`npm test`) and record it passing as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared lifecycle-callback mechanism — types, error
classification, and the `GroundedCall.withLifecycle()` wrapper — and wire it into all
four generators' public entry points. This single wrapper is what makes `onCall`,
`onResult`, and `onError` all fire correctly (FR-002 through FR-008); no user story can
be demonstrated through the public API until it exists, since even the simplest
successful-call scenario (US1) exercises the same wrapper as the failure (US2) and
callback-isolation (US3) scenarios.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

### Tests for the foundational wrapper ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] Unit test for `classifyOperationalError()` in `tests/unit/core/lifecycle-callbacks.test.ts`: asserts `ModelUnavailableError` → `'model-unavailable'`, `InvalidModelOutputError` → `'invalid-output'`, `ContextTooLargeError` → `'context-too-large'`, `ProviderError` → `'provider-error'`, and a plain `Error` (or any other thrown value) → `'unknown'`
- [X] T003 [P] Unit test for `GroundedCall.withLifecycle()` in `tests/unit/core/lifecycle-callbacks.test.ts`, using a minimal test subclass of `GroundedCall` that exposes `withLifecycle()`: on a successful `fn()`, asserts `onCall` fires exactly once before `fn()` runs, `onResult` fires exactly once after with `durationMs >= 0` and the `usedFallback` value taken from `fn()`'s resolved result, both events share the same `callId`, and `onError` is never called
- [X] T004 [P] Unit test for `GroundedCall.withLifecycle()` failure path in `tests/unit/core/lifecycle-callbacks.test.ts`: on a rejecting `fn()` (throwing each of the four typed errors in turn, plus a plain `Error`), asserts `onError` fires exactly once with the matching `errorType`, the same `callId` as `onCall`, and the original error re-thrown to the caller unchanged; asserts `onResult` is never called for these cases
- [X] T005 [US3] Unit test for callback-exception isolation in `tests/unit/core/lifecycle-callbacks.test.ts`: configure `onCall`/`onResult`/`onError` to each throw synchronously when invoked; asserts a successful `fn()` still resolves with its normal value and a rejecting `fn()` still rejects with its original error — no exception from any callback propagates (depends on T003, T004)
- [X] T006 [P] Unit test confirming `withLifecycle()` is a no-op wrapper when no callbacks are configured in `tests/unit/core/lifecycle-callbacks.test.ts`: asserts the resolved value/rejected error from `fn()` is unaffected and no error is thrown from the absence of callbacks (depends on T003, T004)

### Implementation of the foundational wrapper

- [X] T007 Define `LifecycleErrorType`, `CallEvent`, `ResultEvent`, `ErrorEvent`, and `classifyOperationalError()` in `src/core/lifecycle-callbacks.ts`, per data-model.md (depends on T002)
- [X] T008 Add `onCall?`, `onResult?`, `onError?` optional fields to `GroundedCallConfig` in `src/core/types.ts`, typed against `CallEvent`/`ResultEvent`/`ErrorEvent` from `lifecycle-callbacks.ts` (depends on T007)
- [X] T009 Store the resolved `onCall`/`onResult`/`onError` callbacks from `config` on `GroundedCall` in `src/core/grounded-call.ts`'s constructor (depends on T008)
- [X] T010 Implement `protected async withLifecycle<T extends { usedFallback: boolean }>(operation: string, fn: () => Promise<T>): Promise<T>` in `src/core/grounded-call.ts`: generates `callId` via `randomUUID()` from `node:crypto`, invokes `onCall` (catching/discarding any callback exception), runs `fn()`, invokes `onResult` on success or `onError` (via `classifyOperationalError`) on failure — each invocation wrapped so a throwing callback cannot propagate — and always resolves/rejects with `fn()`'s own outcome unchanged (depends on T009, T003, T004, T005, T006)
- [X] T011 [P] Refactor `GroundedGenerator.generate()` in `src/generators/grounded-generator.ts`: move its existing body into a private method, have the public `generate()` delegate through `this.withLifecycle('GroundedGenerator.generate', () => ...)` (depends on T010)
- [X] T012 [P] Refactor `GroundedEnricher.generate()` in `src/generators/grounded-enricher.ts`: same delegation pattern, operation label `'GroundedEnricher.generate'` (depends on T010)
- [X] T013 [P] Refactor `GroundedExtractor.extract()` in `src/generators/grounded-extractor.ts`: same delegation pattern, operation label `'GroundedExtractor.extract'` (depends on T010)
- [X] T014 [P] Refactor `GroundedComposer.compose()` in `src/generators/grounded-composer.ts`: same delegation pattern, operation label `'GroundedComposer.compose'` (depends on T010)

**Checkpoint**: `withLifecycle()` fully implemented and unit-tested in isolation; all four generators wired through it. User story phases can now demonstrate this behavior through each generator's public API.

---

## Phase 3: User Story 1 - Observe every call without touching call sites (Priority: P1)

**Goal**: A developer who configures `onCall`/`onResult` at construction sees them fire correctly for every successful call of any of the four generators, with no change to any call site, and sees zero behavior difference when no callbacks are configured.

**Independent Test**: Configure `onCall` and `onResult` on a generator, make a successful call, and verify both fire once with the expected payload and the call's own result is unaffected; then repeat with no callbacks configured and confirm identical results.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already lands in Phase 2 — these tests exercise it through each generator's public API).

- [X] T015 [P] [US1] Unit test in `tests/unit/generators/grounded-generator.test.ts`: construct with `onCall`/`onResult` configured, call `generate()` successfully with a mocked model client, assert `onCall` fires once before the mocked model call with `operation: 'GroundedGenerator.generate'`, `onResult` fires once after with matching `callId`, correct `durationMs >= 0`, and `usedFallback` matching the returned result
- [X] T016 [P] [US1] Unit test in `tests/unit/generators/grounded-enricher.test.ts`: same assertions as T015 for `GroundedEnricher.generate()`, operation label `'GroundedEnricher.generate'`
- [X] T017 [P] [US1] Unit test in `tests/unit/generators/grounded-extractor.test.ts`: same assertions as T015 for `GroundedExtractor.extract()`, operation label `'GroundedExtractor.extract'`
- [X] T018 [P] [US1] Unit test in `tests/unit/generators/grounded-composer.test.ts`: same assertions as T015 for `GroundedComposer.compose()`, operation label `'GroundedComposer.compose'`, additionally asserting `usedFallback` is always reported `false`
- [X] T019 [US1] Unit test in `tests/unit/generators/grounded-generator.test.ts` confirming that constructing `GroundedGenerator` with no `onCall`/`onResult`/`onError` configured and making the same successful call produces a result identical to T015's (no observable behavior change; FR-009) (depends on T015)

### Implementation for User Story 1

- [X] T020 [US1] Verify (adjust if any test in T015-T019 reveals a gap) that the Phase 2 wiring in all four generators satisfies these assertions with no further production code changes (depends on T015, T016, T017, T018, T019, T011, T012, T013, T014)

**Checkpoint**: User Story 1 is fully functional and independently testable — this alone is a viable MVP for the issue's core ask.

---

## Phase 4: User Story 2 - Distinguish failure types for alerting (Priority: P1)

**Goal**: A developer who configures `onError` sees a specific, distinguishable classification for each of the known operational failure modes, across all four generators.

**Independent Test**: Force each known failure mode (model-unavailable, invalid-output, context-too-large, provider-level) on a generator and verify `onError` reports a distinct classification for each, with `onResult` never firing for these calls.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already lands in Phase 2 — these tests exercise it through each generator's public API).

- [X] T021 [P] [US2] Unit test in `tests/unit/generators/grounded-generator.test.ts`: construct with `onError` configured, force a mocked model-unavailable failure, assert `onError` fires once with `errorType: 'model-unavailable'`, matching `callId` from a preceding `onCall`, and `onResult` never fires; the thrown `ModelUnavailableError` still propagates to the caller unchanged
- [X] T022 [P] [US2] Unit test in `tests/unit/generators/grounded-generator.test.ts`: same as T021 but forcing an invalid/refused model output, asserting `errorType: 'invalid-output'`
- [X] T023 [P] [US2] Unit test in `tests/unit/generators/grounded-generator.test.ts`: same as T021 but calling with a prompt exceeding `maxContextTokens`, asserting `errorType: 'context-too-large'` (thrown before the mocked model client is ever invoked)
- [X] T024 [P] [US2] Unit test in `tests/unit/generators/grounded-extractor.test.ts`: repeat T021-T023's three failure modes for `GroundedExtractor.extract()`, confirming the same classifications
- [X] T025 [P] [US2] Unit test in `tests/unit/generators/grounded-composer.test.ts`: repeat T021-T023's three failure modes for `GroundedComposer.compose()`, confirming the same classifications

### Implementation for User Story 2

- [X] T026 [US2] Verify (adjust if any test in T021-T025 reveals a gap) that the Phase 2 error classification and wiring satisfies these assertions across all four generators with no further production code changes (depends on T021, T022, T023, T024, T025, T007, T010)

**Checkpoint**: User Stories 1 AND 2 both work independently — the core observability and alerting use cases from the issue are both satisfied.

---

## Phase 5: User Story 3 - Callbacks never put the call at risk (Priority: P2)

**Goal**: A developer can safely wire up a broken (throwing) callback without it affecting the call's own result, error, or timing, demonstrated through each generator's public API (the underlying isolation mechanism itself is already unit-tested in Phase 2).

**Independent Test**: Configure a callback that throws, make a call through any generator, and verify the call still completes with its normal result/error.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already lands in Phase 2 — these tests exercise it through the public API).

- [X] T027 [P] [US3] Unit test in `tests/unit/generators/grounded-generator.test.ts`: construct with `onCall`/`onResult`/`onError` all throwing synchronously when invoked, make one successful call and one failing call, assert both results are byte-for-byte identical to the equivalent calls in T015/T021 (minus the callback side effects) and no callback exception surfaces to the caller
- [X] T028 [P] [US3] Unit test in `tests/unit/generators/grounded-enricher.test.ts`: same as T027 for `GroundedEnricher`
- [X] T029 [US3] Unit test in `tests/unit/generators/grounded-generator.test.ts` for the fallback-used edge case: construct with `fallbackValue` and `onResult` configured, force fallback usage, assert `onResult` fires with `usedFallback: true` and `onError` is never called (depends on T015)

### Implementation for User Story 3

- [X] T030 [US3] Verify (adjust if any test in T027-T029 reveals a gap) that the Phase 2 isolation guarantees hold through the public API with no further production code changes (depends on T027, T028, T029, T005, T010)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Public API exposure, documentation, quickstart validation, and no-regression confirmation, after all user stories are complete.

- [X] T031 [US1] [US2] [US3] Export `CallEvent`, `ResultEvent`, `ErrorEvent`, and `LifecycleErrorType` as public API types from `src/index.ts`, alongside the existing `GroundedCallConfig` export (depends on T007, T008)
- [X] T032 [P] Add a "Structured logging hooks" section to `README.md` (both English and Português sections, per the existing bilingual structure) with a basic console-logging example and a Prometheus-style metrics example, per FR-012/SC-005 (depends on T031)
- [X] T033 Run all 9 `quickstart.md` validation scenarios end-to-end against the implementation
- [X] T034 Re-run the full existing test suite (all pre-existing tests for `GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, `GroundedComposer` — unit, contract, evaluation) and confirm 100% pass with no behavior change
- [X] T035 Build verification: `npm run build` succeeds and `npm test` passes fully (all pre-existing tests + all new lifecycle-callback tests)

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → User story phases (3, 4, 5) → **Phase 6 (Polish)**
- Phase 2 is unusually load-bearing for this feature: because `onCall`/`onResult`/`onError` are dispatched by one shared wrapper wired into all four generators at once, the implementation for all three user stories lands in Phase 2; Phases 3-5 add the user-facing tests that independently verify each story's guarantee through the public API, plus one edge-case test each (T029) or a verification task confirming no gap exists.
- User Story 1 (Phase 3) has no dependency on US2/US3 beyond the shared Phase 2 foundation, and is independently shippable as the MVP.
- User Story 2 (Phase 4) depends only on the same Phase 2 foundation, not on Phase 3.
- User Story 3 (Phase 5) depends only on the same Phase 2 foundation; its core mechanism (T005) is already covered at the wrapper level in Phase 2, so Phase 5 focuses on public-API-level confirmation.

## Parallel Execution Examples

- Within Phase 2: T002, T003, T004, T006 can start in parallel (independent test cases in the same new file, no shared mutable state); T011-T014 (the four generator refactors) can run in parallel once T010 lands, since each touches a different file.
- Within Phase 3: T015-T018 can all run in parallel (one per generator file).
- Within Phase 4: T021-T023 (same file) run sequentially or in parallel depending on mock isolation; T024-T025 can run in parallel with the Phase 4 GroundedGenerator tests (different files).
- Within Phase 5: T027 and T028 can run in parallel (different files).
- T032 (Phase 6, README) can run in parallel with T033-T034 once T031 lands.

## Suggested MVP Scope

**User Story 1 alone** (Phases 1-3) is a viable MVP: `onCall`/`onResult` observability across all four generators, fully backward compatible when unconfigured. User Story 2 (failure classification) and User Story 3 (callback-safety confirmation at the public-API level) are incremental hardening on top of that MVP — though note Phase 2's foundational work already implements all three stories' underlying mechanism in one pass, so in practice all three stories become available together once Phase 2 lands.

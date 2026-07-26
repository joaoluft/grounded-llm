---

description: "Task list for feature implementation"
---

# Tasks: Pluggable Result Cache

**Input**: Design documents from `/specs/009-pluggable-result-cache/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/result-cache.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires the shared cache
short-circuit and key derivation, plus each generator's wiring, to have tests written
before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md. One new file (`src/core/result-cache.ts`);
modifications to `src/core/types.ts`, `src/core/grounded-call.ts`, and all four files
under `src/generators/`, following the kebab-case file naming already established
(feature 005).

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since no existing
component's observable behavior may regress (spec User Story 2, FR-001, SC-002).

- [X] T001 Run the full existing test suite (`npm test`) and record it passing as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared cache mechanism — the `ResultCache` contract, the
`deriveCacheKey()` helper, and the `GroundedCall.withLifecycle()` short-circuit — and
wire key-input construction into all four generators' public entry points. This is what
makes a cache hit skip the pipeline (FR-004) while a cache miss transparently writes
through (FR-005); no user story can be demonstrated through the public API until it
exists, since even the simplest cache-hit scenario (US1) and the no-cache-configured
scenario (US2) both exercise the same `withLifecycle()` code path.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

### Tests for the foundational mechanism ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] Unit test for `deriveCacheKey()` in `tests/unit/core/result-cache.test.ts`: asserts two calls with a field-order-shuffled but logically-identical input object produce the same key; asserts changing any single field (request content, `identity`, `rules`, `tone`, `model`, `temperature`) changes the key; asserts two different `operation` labels with otherwise-identical input produce different keys
- [X] T003 [P] Unit test for `GroundedCall.withLifecycle()`'s cache short-circuit in `tests/unit/core/result-cache.test.ts`, using a minimal test subclass of `GroundedCall` that exposes `withLifecycle()` with a `cacheKey` argument and a configurable `cache`: on a cache hit (`get` resolves to a defined value), asserts `fn()` is never invoked, the resolved cached value is returned, and `onCall`/`onResult` still fire with that value's `usedFallback`
- [X] T004 [P] Unit test for the cache-miss write-through path in `tests/unit/core/result-cache.test.ts`: on a cache miss (`get` resolves to `undefined`), asserts `fn()` runs exactly once, its result is passed to `set(key, result)`, and that same result is returned to the caller
- [X] T005 [P] Unit test for cache failure isolation in `tests/unit/core/result-cache.test.ts`: a `get` that throws/rejects is treated as a miss (`fn()` still runs and its result is still returned); a `set` that throws/rejects after a successful `fn()` does not change the value returned to the caller or propagate (depends on T003, T004)
- [X] T006 [P] Unit test confirming `withLifecycle()` with no `cache` configured never calls `get`/`set` and behaves exactly as before this feature (no `cacheKey` short-circuit possible) in `tests/unit/core/result-cache.test.ts` (depends on T003, T004)
- [X] T007 [P] Unit test for sync- and Promise-returning `ResultCache` implementations in `tests/unit/core/result-cache.test.ts`: a cache whose `get`/`set` return plain values/`void` synchronously and a cache whose `get`/`set` return `Promise`s both work identically through `withLifecycle()` (depends on T003, T004)

### Implementation of the foundational mechanism

- [X] T008 Define `ResultCache` interface and `deriveCacheKey(operation: string, input: unknown): string` (stable, recursively key-sorted `JSON.stringify` + `sha256` hex digest via `node:crypto`'s `createHash`) in `src/core/result-cache.ts`, per data-model.md and research.md Decision 2 (depends on T002)
- [X] T009 Add `cache?: ResultCache` to `GroundedCallConfig` in `src/core/types.ts`, typed against `ResultCache` from `result-cache.ts`, per contracts/result-cache.md (depends on T008)
- [X] T010 Store the resolved `cache` from `config` on `GroundedCall` in `src/core/grounded-call.ts`'s constructor (depends on T009)
- [X] T011 Extend `protected async withLifecycle<T extends { usedFallback: boolean }>(operation: string, fn: () => Promise<T>, cacheKey?: string): Promise<T>` in `src/core/grounded-call.ts`: when `this.cache` and `cacheKey` are both present, `await` a try/caught `this.cache.get(cacheKey)` first — on a defined result, dispatch `onCall`/`onResult` with it and return it without calling `fn()`; on a miss or `get` failure, run `fn()` as before, and on success `await` a try/caught `this.cache.set(cacheKey, result)` before returning (depends on T010, T003, T004, T005, T006, T007)
- [X] T012 [P] Add a private `buildCacheKeyInput()` (or equivalent) to `GroundedGenerator` in `src/generators/grounded-generator.ts` composing `{context, question}` plus `this.identity`/`this.rules`/`this.tone`/`this.model`/`this.temperature`, pass `deriveCacheKey('GroundedGenerator.generate', input)` as `withLifecycle()`'s new `cacheKey` argument (depends on T011, T008)
- [X] T013 [P] Same wiring as T012 for `GroundedEnricher` in `src/generators/grounded-enricher.ts`, key input from `{baseContent, context}` plus the shared instance fields, operation label `'GroundedEnricher.generate'` (depends on T011, T008)
- [X] T014 [P] Same wiring as T012 for `GroundedExtractor` in `src/generators/grounded-extractor.ts`, key input from `{message}` plus the shared instance fields and this component's own `fields`/`strict`, operation label `'GroundedExtractor.extract'` (depends on T011, T008)
- [X] T015 [P] Same wiring as T012 for `GroundedComposer` in `src/generators/grounded-composer.ts`, key input from `{instructions, context}` plus the shared instance fields, operation label `'GroundedComposer.compose'` (depends on T011, T008)

**Checkpoint**: Cache short-circuit fully implemented and unit-tested in isolation; all
four generators wired through it. User story phases can now demonstrate this behavior
through each generator's public API.

---

## Phase 3: User Story 1 - Skip redundant pipeline runs for identical requests (Priority: P1)

**Goal**: A developer who configures a cache sees an identical repeated request served
from that cache, with the pipeline and model provider never invoked a second time.

**Independent Test**: Configure an in-memory cache on a generator, issue the same request
twice, and verify the second call returns the identical result without a second call to
the mocked model provider.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already
> lands in Phase 2 — these tests exercise it through each generator's public API).

- [X] T016 [P] [US1] Unit test in `tests/unit/generators/grounded-generator.test.ts`: construct with an in-memory `Map`-backed `cache`, call `generate()` twice with identical `{context, question}` against a mocked model client, assert the mocked model is invoked exactly once and both calls resolve with equal (`toEqual`) results
- [X] T017 [P] [US1] Unit test in `tests/unit/generators/grounded-enricher.test.ts`: same assertions as T016 for `GroundedEnricher.generate()`
- [X] T018 [P] [US1] Unit test in `tests/unit/generators/grounded-extractor.test.ts`: same assertions as T016 for `GroundedExtractor.extract()`
- [X] T019 [P] [US1] Unit test in `tests/unit/generators/grounded-composer.test.ts`: same assertions as T016 for `GroundedComposer.compose()`
- [X] T020 [US1] Unit test in `tests/unit/generators/grounded-generator.test.ts`: with the same cache configured, two calls that differ only in `question` (or only in `context`) each invoke the mocked model client, proving distinct requests never collide (spec SC-004) (depends on T016)
- [X] T021 [US1] Unit test in `tests/unit/generators/grounded-generator.test.ts`: with `fallbackValue` and a cache both configured, force fallback usage on the first call, assert the second identical call returns the cached fallback result without invoking the mocked model client again (spec Edge Cases — fallback results are cached too) (depends on T016)

### Implementation for User Story 1

- [X] T022 [US1] Verify (adjust if any test in T016-T021 reveals a gap) that the Phase 2 wiring in all four generators satisfies these assertions with no further production code changes (depends on T016, T017, T018, T019, T020, T021, T012, T013, T014, T015)

**Checkpoint**: User Story 1 is fully functional and independently testable — this alone
is a viable MVP for the issue's core ask.

---

## Phase 4: User Story 2 - No behavior change when caching is not configured (Priority: P1)

**Goal**: A developer who does not configure a cache sees zero difference from
pre-feature behavior — every call runs the full pipeline, every time.

**Independent Test**: Run the existing generator test suites unmodified (no `cache`
configured anywhere in them) and confirm they still pass exactly as before this feature.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already
> lands in Phase 2 — these tests exercise it through each generator's public API).

- [X] T023 [P] [US2] Unit test in `tests/unit/generators/grounded-generator.test.ts`: construct with no `cache` configured, call `generate()` twice with identical `{context, question}` against a mocked model client, assert the mocked model is invoked exactly twice (no caching occurs)
- [X] T024 [P] [US2] Unit test in `tests/unit/generators/grounded-composer.test.ts`: same assertion as T023 for `GroundedComposer.compose()`
- [X] T025 [US2] Unit test in `tests/unit/core/result-cache.test.ts` confirming `withLifecycle()` called without a `cacheKey` argument (even when `cache` *is* configured) always runs `fn()` and never touches `cache.get`/`cache.set` — covers any future entry point that opts out of caching for a given operation (depends on T006)

### Implementation for User Story 2

- [X] T026 [US2] Verify (adjust if any test in T023-T025 reveals a gap) that the Phase 2 `withLifecycle()` guard (`this.cache && cacheKey`) satisfies these assertions with no further production code changes (depends on T023, T024, T025, T011)

**Checkpoint**: User Stories 1 AND 2 both work independently — caching is fully opt-in
with no regression for existing integrations.

---

## Phase 5: User Story 3 - Bring your own cache backend (Priority: P2)

**Goal**: A developer can back the cache with any store they choose — synchronous
in-memory or asynchronous/remote — without adapting their implementation to a
library-specific shape, and a failing backend never breaks a request.

**Independent Test**: Provide two different cache implementations (plain in-memory map,
and a stub mimicking an async remote store, including one that throws) against the same
request sequence and confirm both integrate correctly.

### Tests for User Story 3 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (implementation already
> lands in Phase 2 — these tests exercise it through the public API).

- [X] T027 [P] [US3] Unit test in `tests/unit/generators/grounded-generator.test.ts`: configure a `cache` whose `get`/`set` return `Promise`s (simulating a remote store), repeat T016's two-identical-calls scenario, assert identical caching behavior to the synchronous case
- [X] T028 [P] [US3] Unit test in `tests/unit/generators/grounded-generator.test.ts`: configure a `cache` whose `get` and `set` both synchronously throw, call `generate()`, assert the call still resolves normally with a real (uncached) result and no exception propagates (spec FR-007, SC-005)
- [X] T029 [US3] Unit test in `tests/unit/generators/grounded-generator.test.ts`: configure a `cache` whose `get`/`set` both return rejected `Promise`s, repeat T028's assertion for the async-failure case (depends on T028)

### Implementation for User Story 3

- [X] T030 [US3] Verify (adjust if any test in T027-T029 reveals a gap) that the Phase 2 `await`-based, try/caught `get`/`set` handling in `withLifecycle()` satisfies these assertions with no further production code changes (depends on T027, T028, T029, T005, T007, T011)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Public API exposure, documentation, quickstart validation, and no-regression
confirmation, after all user stories are complete.

- [X] T031 [US1] [US2] [US3] Export `ResultCache` as a public API type from `src/index.ts`, alongside the existing `GroundedCallConfig` export (depends on T008, T009)
- [X] T032 [P] Add a "Result cache" section to `README.md` (both English and Português sections, per the existing bilingual structure) documenting the `cache` option, the `{ get, set }` contract, what participates in key derivation, and that invalidation is the caller's responsibility, with a `Map`-backed example (depends on T031)
- [X] T033 Run all `quickstart.md` validation scenarios end-to-end against the implementation
- [X] T034 Re-run the full existing test suite (all pre-existing tests for `GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, `GroundedComposer` — unit, contract, evaluation) and confirm 100% pass with no behavior change
- [X] T035 Build verification: `npm run build` succeeds and `npm test` passes fully (all pre-existing tests + all new result-cache tests)

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → User story phases (3, 4, 5) → **Phase 6 (Polish)**
- Phase 2 is unusually load-bearing for this feature: because the cache short-circuit is
  one mechanism shared by all four generators, the implementation for all three user
  stories lands in Phase 2; Phases 3-5 add the user-facing tests that independently
  verify each story's guarantee through the public API, plus each story's specific edge
  cases (e.g. T021's cached-fallback case, T028/T029's failure-isolation cases).
- User Story 1 (Phase 3) has no dependency on US2/US3 beyond the shared Phase 2
  foundation, and is independently shippable as the MVP.
- User Story 2 (Phase 4) depends only on the same Phase 2 foundation, not on Phase 3.
- User Story 3 (Phase 5) depends only on the same Phase 2 foundation; its core mechanism
  (T005, T007) is already covered at the wrapper level in Phase 2, so Phase 5 focuses on
  public-API-level confirmation.

## Parallel Execution Examples

- Within Phase 2: T002-T007 can start in parallel (independent test cases in the same new
  file, no shared mutable state); T012-T015 (the four generators' key-input wiring) can
  run in parallel once T011 lands, since each touches a different file.
- Within Phase 3: T016-T019 can all run in parallel (one per generator file).
- Within Phase 4: T023 and T024 can run in parallel (different files).
- Within Phase 5: T027 and T028 can run in parallel (same file, independent test cases).
- T032 (Phase 6, README) can run in parallel with T033-T034 once T031 lands.

## Suggested MVP Scope

**User Story 1 alone** (Phases 1-3) is a viable MVP: cache-hit short-circuiting across
all four generators. User Story 2 (no-cache-configured safety net) and User Story 3
(backend flexibility and failure isolation) are incremental hardening on top of that
MVP — though note Phase 2's foundational work already implements all three stories'
underlying mechanism in one pass, so in practice all three stories become available
together once Phase 2 lands.

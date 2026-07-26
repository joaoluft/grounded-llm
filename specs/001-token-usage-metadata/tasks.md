---

description: "Task list template for feature implementation"
---

# Tasks: Token Usage & Cost Metadata

**Input**: Design documents from `/specs/001-token-usage-metadata/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — this repo has full unit/contract coverage on every generator and core class; new behavior gets test coverage in the same style as the existing suites.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single project: `src/`, `tests/` at repository root (see plan.md Project Structure).

---

## Phase 1: Setup

- [X] T001 Confirm baseline is green: run `npm run test`, `npm run typecheck`, `npm run build` on branch `6-add-token-usage-cost-metadata-to-groundedresult` before making changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Thread provider usage data through the shared `GroundedCall.callModel` so every generator can attach it. No user story can be completed without this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Add optional `usage?: ProviderUsage` field to `GroundedCallResult` in `src/core/types.ts` (import `ProviderUsage` from `../providers/types`)
- [X] T003 Change `GroundedCall.callModel` in `src/core/grounded-call.ts` to return `Promise<{ data: any; usage?: ProviderUsage }>` instead of `Promise<any>`: standalone/provider-adapter path returns `{ data: response.data, usage: response.usage }` (from the existing `response` at grounded-call.ts:199); `langchainModel` path returns `{ data: await this.modelClient.parse(params), usage: undefined }`
- [X] T004 [P] Update `tests/unit/core/grounded-call.test.ts` to cover the new `callModel` return shape: a mocked provider adapter response with `usage` populated results in `{ data, usage }` being returned, and the `langchainModel` path always returns `usage: undefined`

**Checkpoint**: `callModel` now exposes `usage` alongside `data` to every generator — user story implementation can begin.

---

## Phase 3: User Story 1 - Read token usage after a standalone call (Priority: P1) 🎯 MVP

**Goal**: Every generator's result carries a correct `usage` field in standalone mode.

**Independent Test**: Call any generator in standalone mode with a mocked provider response containing `usage`, and confirm the returned result's `usage` matches.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T005 [P] [US1] Extend `tests/unit/generators/grounded-generator.test.ts`: success path asserts `result.usage` equals the mocked `callModel` usage; fallback path (no successful call) asserts `result.usage` is `undefined`
- [X] T006 [P] [US1] Extend `tests/unit/generators/grounded-enricher.test.ts` with the same success/fallback `usage` assertions
- [X] T007 [P] [US1] Extend `tests/unit/generators/grounded-extractor.test.ts` with the same success/fallback `usage` assertions
- [X] T008 [P] [US1] Extend `tests/unit/generators/grounded-composer.test.ts` with the same success/fallback `usage` assertions

### Implementation for User Story 1

- [X] T009 [P] [US1] In `src/generators/grounded-generator.ts`, destructure `{ data: rawOutput, usage }` from `this.callModel(...)` (line ~72) and attach `usage` to the object returned by `doGenerate`'s success path (grounded-generator.ts:98-103); leave `usage` unset on the fallback path (`buildFallbackResult`, grounded-generator.ts:106-116) unless a call actually completed
- [X] T010 [P] [US1] In `src/generators/grounded-enricher.ts`, same threading into `doGenerate`'s success return (grounded-enricher.ts:85-90) and fallback/unchanged return (grounded-enricher.ts:98-103)
- [X] T011 [P] [US1] In `src/generators/grounded-extractor.ts`, add `usage?: ProviderUsage` to `GroundedExtractionResult<Fields>` (grounded-extractor.ts:26-30) and thread it into `doExtract`'s success return (grounded-extractor.ts:119) and `buildFallbackResult` (grounded-extractor.ts:127-132)
- [X] T012 [P] [US1] In `src/generators/grounded-composer.ts`, add `usage?: ProviderUsage` to its inline result type and thread it into the success return (grounded-composer.ts:76-81) and its fallback path
- [X] T013 [US1] Run `npm run test -- grounded-generator grounded-enricher grounded-extractor grounded-composer grounded-call` and confirm all new and existing tests pass

**Checkpoint**: User Story 1 fully functional — standalone-mode calls across all four generators return correct `usage`.

---

## Phase 4: User Story 2 - Understand usage availability in LangChain mode (Priority: P2)

**Goal**: `langchainModel`-mode calls never error due to missing usage, and this is documented.

**Independent Test**: Call a generator in `langchainModel` mode and confirm `result.usage` is `undefined` with no error; confirm the README states this explicitly.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Extend `tests/unit/core/langchain-model-client.test.ts` (or the relevant generator test using a mocked `langchainModel`) to assert a full generate call in `langchainModel` mode completes successfully with `result.usage === undefined`

### Implementation for User Story 2

- [X] T015 [US2] Verify (no code change expected, per research.md Decision 2) that the T003 `callModel` change correctly yields `usage: undefined` for every generator when `this.modelClient` is set; fix if any generator's result-building logic accidentally defaults `usage` to `{}` or `0`-valued fields instead of `undefined`
- [X] T016 [US2] Add a "Token usage & cost metadata" section to `README.md` (English, placed after "Structured logging hooks", README.md:341-404) documenting the `usage` field shape and explicitly stating it may be `undefined` in `langchainModel` mode
- [X] T017 [US2] Add the mirrored "Uso de tokens e metadados de custo" section to the Português part of `README.md` (after "Hooks de logging estruturado", README.md:699) with the same content translated

**Checkpoint**: User Stories 1 AND 2 both work independently; `langchainModel` behavior is safe and documented.

---

## Phase 5: User Story 3 - Aggregate usage across multiple calls (Priority: P3)

**Goal**: Developers have a documented, verified pattern to sum `usage` across many calls.

**Independent Test**: Follow the README aggregation example across several calls and confirm totals match the sum of individual `usage` values.

### Implementation for User Story 3

- [X] T018 [US3] Add a runnable aggregation example to the new README section from T016 (English), matching the pattern validated in `specs/001-token-usage-metadata/quickstart.md` (treat missing `usage` as zero contribution)
- [X] T019 [US3] Add the same aggregation example to the mirrored Português section from T017

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 Run `npm run lint` and fix any new lint issues introduced by the above changes (0 new errors introduced — pre-existing 27 errors in unrelated `*.evaluation.test.ts`/`*.integration.test.ts` files are unchanged from `main`; only 3 new `no-explicit-any` warnings added, matching this test suite's existing convention)
- [X] T021 Run full suite: `npm run test`, `npm run typecheck`, `npm run build` — confirm everything green end-to-end (210/210 tests pass, typecheck clean, build succeeds)
- [X] T022 Walk through `specs/001-token-usage-metadata/quickstart.md` manually (or via a throwaway script) to sanity-check the standalone, langchainModel, and aggregation examples read correctly against the actual implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only — MVP, deliver first
- **User Story 2 (Phase 4)**: Depends on Foundational only; T015 depends conceptually on T003/T009-T012 being in place (verification step), but no code conflicts — can start in parallel with US1, though verification is easiest once US1 lands
- **User Story 3 (Phase 5)**: Depends on the README section existing (T016/T017 from US2) — sequenced after US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Parallel Opportunities

- T009-T012 (the four generators) are in different files and can run in parallel once T002/T003 land
- T005-T008 (the four generator test files) can run in parallel
- T016/T017 (EN/PT README sections) can run in parallel with each other, but both depend on US1 being implemented so the documented shape is accurate

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup baseline check
2. Phase 2: Foundational `callModel`/type threading
3. Phase 3: User Story 1 — all four generators return correct `usage` in standalone mode
4. **STOP and VALIDATE**: run T013's test subset independently
5. This alone closes the issue's core acceptance criterion (`result.usage` present and correct in standalone mode)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. User Story 1 → validate → MVP
3. User Story 2 → validate → safe + documented `langchainModel` behavior
4. User Story 3 → validate → aggregation pattern documented
5. Polish → full-suite confirmation

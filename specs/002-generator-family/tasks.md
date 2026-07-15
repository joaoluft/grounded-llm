---

description: "Task list for feature implementation"
---

# Tasks: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Input**: Design documents from `/specs/002-generator-family/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/GroundedEnricher.md, contracts/GroundedExtractor.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires schema tests and behavior tests with a mocked OpenAI client written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md — reuses `src/core/` unchanged; new/changed files
under `src/generators/`, `tests/unit/generators/`, `tests/contract/generators/`.

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since SC-105 requires zero regression on the existing `GroundedGenerator`.

- [X] T001 Run the full existing test suite (`npm test`) and record it passing (31/31 from feature 001) as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the shared base needs no changes for this feature — both new components reuse it as-is.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete (trivial here, since nothing changes).

- [X] T002 Confirm `src/core/GroundedCall.ts`, `src/core/types.ts`, `src/core/errors.ts`, and `src/core/contextWindow.ts` require no modification for `GroundedEnricher` or `GroundedExtractor` (both reuse `GroundedCall` and `GroundedCallConfig`/`GroundedCallResult`/error types unchanged, per research.md) — document this explicitly as a code comment is not needed, this is a verification-only task

**Checkpoint**: Foundation confirmed reusable; user story implementation can begin.

---

## Phase 3: User Story 1 - Enriquecer uma resposta existente com contexto recuperado (Priority: P1)

**Goal**: `GroundedEnricher` enriches a base text with retrieved context, returning the base text unchanged (not a generic fallback string) when the context doesn't support safe enrichment.

**Independent Test**: Call the component with (baseContent, context) where context has relevant additional info; verify the enriched text is traceable to context + baseContent. Call again with insufficient context; verify baseContent is returned unchanged with `usedFallback = true`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T003 [P] [US1] Contract test for the enrichment structured output schema (`extracted_facts: string[]`, `sufficient_context: boolean`, `reasoning: string`, `enriched_text: string` via `zodResponseFormat` with `strict: true`) in `tests/contract/generators/GroundedEnricher.schema.test.ts`
- [X] T004 [P] [US1] Unit tests for the sufficient-context happy path in `tests/unit/generators/GroundedEnricher.test.ts`: mocked response with `sufficient_context: true` asserts `usedFallback = false`, `finalAnswer` incorporates `baseContent` + `extractedFacts`, `reasoning` present, `temperature: 0` sent by default
- [X] T005 [US1] Unit test for insufficient context in `tests/unit/generators/GroundedEnricher.test.ts`: mocked response with `sufficient_context: false` asserts `usedFallback = true` and `finalAnswer === baseContent` (unchanged), NOT `fallbackValue` (depends on T004)
- [X] T006 [US1] Unit test for empty/blank `context` in `tests/unit/generators/GroundedEnricher.test.ts`: asserts `usedFallback = true`, `finalAnswer === baseContent`, and the model is never called (depends on T005)
- [X] T007 [US1] Unit test for empty/blank `baseContent` in `tests/unit/generators/GroundedEnricher.test.ts`: asserts the call throws immediately as invalid usage (FR-110) — never returning a `GroundedCallResult`, never touching `fallbackValue` — distinct from the FR-106 fallback path, and the model is never called (depends on T005)

### Implementation for User Story 1

- [X] T008 [US1] Define the Zod output schema (`extracted_facts`, `sufficient_context`, `reasoning`, `enriched_text`) and its `zodResponseFormat` conversion in `src/generators/GroundedEnricher.schema.ts`, per research.md's field-naming decision
- [X] T009 [US1] Implement the `GroundedEnricher` class extending `GroundedCall` in `src/generators/GroundedEnricher.ts`: builds the prompt instructing literal extraction from `context` relevant to `baseContent`, an explicit sufficiency decision, and an enriched text derived only from `baseContent` + extracted excerpts; calls the model with the schema's `response_format` and configured `temperature` (depends on T008, T009 of feature 001's `GroundedCall`)
- [X] T010 [US1] Implement empty/blank-`baseContent` validation in `src/generators/GroundedEnricher.ts`: reject immediately as invalid usage, before calling the model (depends on T009)
- [X] T011 [US1] Implement the insufficient-context branch in `src/generators/GroundedEnricher.ts`: when `sufficient_context = false` or `extracted_facts` is empty, map to `GroundedCallResult` with `finalAnswer: baseContent` (unchanged) and `usedFallback: true`; include an empty/blank-`context` short-circuit that skips the model call entirely (depends on T009)
- [X] T012 [US1] Implement the sufficient-context result mapping in `src/generators/GroundedEnricher.ts`: when `sufficient_context = true`, map to `GroundedCallResult` with `finalAnswer: enriched_text`, `usedFallback: false`, `extractedFacts: extracted_facts`, `reasoning` (depends on T009)
- [X] T013 [US1] Wire the context-overflow, technical-failure, and invalid-output guards (reused from `GroundedCall`) into `GroundedEnricher`'s generation call in `src/generators/GroundedEnricher.ts` (depends on T009)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Extrair dados estruturados definidos pelo desenvolvedor a partir da mensagem do usuário (Priority: P1)

**Goal**: `GroundedExtractor` extracts a developer-defined structured object from a user message, with a mandatory whole-object fallback, per-field `null`s for partial extraction by default, and a `strict` mode that requires full extraction or falls back entirely.

**Independent Test**: Call the component with a `fields` schema and a message that fully, partially, or not-at-all supports those fields; verify the three distinct outcomes (full data, partial data with `null`s, or `fallbackValue`) per the configured `strict` setting.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T014 [P] [US2] Contract test for the extractor's dynamically-built structured output schema in `tests/contract/generators/GroundedExtractor.schema.test.ts`: given a sample `fields` definition, asserts each field becomes nullable in the generated schema, a `reasoning: string` field is added, and `zodResponseFormat` produces `strict: true`
- [X] T015 [P] [US2] Unit tests for construction/config validation in `tests/unit/generators/GroundedExtractor.test.ts`: missing `fallbackValue` rejected immediately; missing `fields` rejected immediately; `strict` defaults to `false` when omitted
- [X] T016 [US2] Unit test for full extraction success in `tests/unit/generators/GroundedExtractor.test.ts`: mocked response with all fields non-null asserts `usedFallback = false`, `data` matches the mocked values, `reasoning` is present (FR-207), and the request sent to the client uses `temperature: 0` by default (FR-208) (depends on T015)
- [X] T017 [US2] Unit test for partial extraction in non-strict mode (default) in `tests/unit/generators/GroundedExtractor.test.ts`: mocked response with some fields `null` asserts `usedFallback = false` and `data` contains the extracted fields plus `null`s for the rest (depends on T016)
- [X] T018 [US2] Unit test for partial extraction in strict mode in `tests/unit/generators/GroundedExtractor.test.ts`: same mocked partial response as T017, but constructed with `strict: true`, asserts `usedFallback = true` and `data === fallbackValue` (whole object, no partial data) (depends on T016)
- [X] T019 [US2] Unit test for a message with no extractable information in `tests/unit/generators/GroundedExtractor.test.ts`: mocked response with all fields `null` asserts `usedFallback = true` and `data === fallbackValue`, and a separate case for an empty/blank `message` asserting the same without calling the model (depends on T016)

### Implementation for User Story 2

- [X] T020 [US2] Implement the schema-building helper in `src/generators/GroundedExtractor.schema.ts`: accepts the developer-provided `fields` as a plain `ZodRawShape` (per research.md), calls `z.object(fields)` internally and makes every field `.nullable()`, adds a `reasoning: z.string()` field, and exposes a function producing the `zodResponseFormat`-wrapped schema (depends on T014)
- [X] T021 [US2] Define `GroundedExtractionConfig<Fields>` and `GroundedExtractionResult<Fields>` types in `src/generators/GroundedExtractor.ts` (or a co-located types section), per data-model.md: config includes `fields`, `fallbackValue` (whole object, required), `strict?` (default `false`), plus the same `client`/`apiKey`/`model`/`temperature`/`maxContextTokens` shape as `GroundedCallConfig`
- [X] T022 [US2] Implement the `GroundedExtractor` class extending `GroundedCall` in `src/generators/GroundedExtractor.ts`: constructor validates `fields` and `fallbackValue` are provided (fail fast), resolves `strict` default `false`; builds the prompt instructing extraction strictly from `message` content, calls the model with the schema from T020 (depends on T009 of feature 001, T020, T021)
- [X] T023 [US2] Implement empty/blank-`message` short-circuit in `src/generators/GroundedExtractor.ts`: skip the model call entirely and return `fallbackValue` with `usedFallback: true` (depends on T022)
- [X] T024 [US2] Implement the result-mapping logic in `src/generators/GroundedExtractor.ts` per research.md: all fields null → `fallbackValue`/`usedFallback: true`; all fields non-null → extracted `data`/`usedFallback: false`; some fields null → non-strict returns partial `data`/`usedFallback: false`, strict returns `fallbackValue`/`usedFallback: true` (depends on T022)
- [X] T025 [US2] Wire the context-overflow, technical-failure, and invalid-output guards (reused from `GroundedCall`) into `GroundedExtractor`'s generation call in `src/generators/GroundedExtractor.ts` (depends on T022)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Melhorar a qualidade da decisão de suficiência do GroundedGenerator existente (Priority: P3)

**Goal**: Add per-field descriptions to `GroundedGenerator`'s structured output schema, with zero behavior regression.

**Independent Test**: The existing `GroundedGenerator` test suite (feature 001) passes unchanged; the JSON schema sent to the model now includes descriptive text per field.

### Tests for User Story 3 ⚠️

- [X] T026 [US3] Add an assertion to `tests/contract/generators/GroundedGenerator.schema.test.ts` (existing file from feature 001) verifying that the `zodResponseFormat`-generated JSON schema includes a non-empty `description` for each of `extracted_facts`, `sufficient_context`, `reasoning`, and `final_answer`, and that `sufficient_context`'s description matches "Se o contexto fornecido é suficiente para responder com segurança, sem completar com conhecimento externo." (or the equivalent English wording already used in the codebase)

### Implementation for User Story 3

- [X] T027 [US3] Add `.describe(...)` to each field of `groundedGenerationSchema` in `src/generators/schema.ts` (FR-301), without changing field names, types, or `GroundedGenerator.ts`'s mapping logic (depends on T026)
- [X] T028 [US3] Re-run the full feature-001 test suite (`GroundedGenerator.test.ts`, `GroundedGenerator.schema.test.ts`, `GroundedGenerator.integration.test.ts`, both evaluation suites) and confirm 100% pass with no behavior change (FR-302, SC-105) (depends on T027)

**Checkpoint**: All three user stories are independently functional; no regression in `GroundedGenerator`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Public API exposure, documentation, and Success Criteria evaluation harnesses, after all user stories are complete.

- [X] T029 [US1] [US2] Export `GroundedEnricher` and `GroundedExtractor` (and their config/result types) as public API in `src/index.ts` (depends on T009, T022)
- [X] T030 [P] Add usage examples for `GroundedEnricher` and `GroundedExtractor` to `README.md` (both Português and English sections, per the existing bilingual structure), noting the fallback semantics unique to each (depends on T029)
- [X] T031 Run all 6 `quickstart.md` validation scenarios end-to-end against the implementation
- [X] T032 [P] Build a fixed evaluation set of at least 20 (baseContent, context) pairs with sufficient context in `tests/unit/generators/GroundedEnricher.traceability.evaluation.test.ts`; assert the enriched text is traceable to `baseContent` + `extractedFacts` for 100% of the set (SC-101)
- [X] T033 [P] Build a fixed evaluation set of at least 20 (baseContent, context) pairs with insufficient context (empty, off-topic, unrelated) in `tests/unit/generators/GroundedEnricher.fallbackRate.evaluation.test.ts`; assert `finalAnswer === baseContent` (unchanged) in at least 95% of cases (SC-102)
- [X] T034 [P] Build a fixed evaluation set of at least 20 messages with sufficient information for all defined fields in `tests/unit/generators/GroundedExtractor.traceability.evaluation.test.ts`; assert extracted values are traceable to the message for 100% of the set (SC-103)
- [X] T035 [P] Build a fixed evaluation set of at least 20 messages with no extractable information (empty, off-topic) in `tests/unit/generators/GroundedExtractor.fallbackRate.evaluation.test.ts`; assert `usedFallback = true` and `data === fallbackValue` in at least 95% of cases (SC-104)
- [X] T036 [P] Build a fixed evaluation set of at least 20 messages with partial field coverage in `tests/unit/generators/GroundedExtractor.strictMode.evaluation.test.ts`; assert non-strict mode returns partial data (no fallback) in 100% of cases, and the same set with `strict: true` triggers `fallbackValue` in 100% of cases (SC-106)
- [X] T037 Build verification: `npm run build` succeeds and `npm test` passes fully (all feature 001 + feature 002 tests)

---

## Phase 7: User Story 4 - Personalizar o comportamento do modelo em qualquer componente da família (Priority: P2)

**Goal**: All three components accept optional `identity`/`rules` at construction, appended after each component's built-in grounding instructions — never overriding them.

**Independent Test**: Configure any of the three components with `identity` and/or `rules`; verify these appear in the system message sent to the model, always after the component's built-in instructions, with `identity` before `rules` when both are present.

**Note**: This phase was implemented directly, by explicit user agreement, given its small and well-contained scope (one shared config extension across three already-implemented components) — without a prior formal `/speckit-clarify`/`/speckit-plan`/`/speckit-tasks` pass. These tasks were added to this file retroactively to keep it in sync with what was actually built (see research.md's "Nota de processo").

### Tests for User Story 4 ⚠️

- [X] T038 [P] [US4] Unit tests for `GroundedCall.buildSystemPrompt` in `tests/unit/core/GroundedCall.test.ts`: base prompt unchanged when `identity`/`rules` are omitted; `identity` appended after the base prompt; `rules` appended after the base prompt; both appended in order (base → identity → rules) when present together
- [X] T039 [US4] Unit test for `GroundedGenerator` in `tests/unit/generators/GroundedGenerator.test.ts`: constructed with `identity`/`rules`, asserts both appear in the system message sent to the model, after the built-in instructions (depends on T038)
- [X] T040 [US4] Unit test for `GroundedEnricher` in `tests/unit/generators/GroundedEnricher.test.ts`: same assertion pattern as T039 (depends on T038)
- [X] T041 [US4] Unit test for `GroundedExtractor` in `tests/unit/generators/GroundedExtractor.test.ts`: same assertion pattern as T039 (depends on T038)

### Implementation for User Story 4

- [X] T042 [US4] Add `identity?: string` and `rules?: string` to `GroundedCallConfig` in `src/core/types.ts` (shared by `GroundedGenerator`/`GroundedEnricher`) (depends on T038)
- [X] T043 [US4] Implement `protected buildSystemPrompt(basePrompt: string): string` in `src/core/GroundedCall.ts`: stores `identity`/`rules` from config, appends them (identity then rules) as additional sections after `basePrompt`, framed as non-overriding (depends on T042)
- [X] T044 [US4] Wire `this.buildSystemPrompt(SYSTEM_PROMPT)` into the model call in `src/generators/GroundedGenerator.ts`, replacing the raw `SYSTEM_PROMPT` constant (depends on T043)
- [X] T045 [US4] Wire `this.buildSystemPrompt(SYSTEM_PROMPT)` into the model call in `src/generators/GroundedEnricher.ts`, replacing the raw `SYSTEM_PROMPT` constant (depends on T043)
- [X] T046 [US4] Add `identity?: string`/`rules?: string` to `GroundedExtractionConfig` in `src/generators/GroundedExtractor.ts`, and wire `this.buildSystemPrompt(SYSTEM_PROMPT_PREFIX)` into its model call (depends on T043)
- [X] T047 [P] [US4] Update `README.md` (both Português and English sections) documenting `identity`/`rules` for all three components, in the shared "Generators" overview and in each component's config comment (depends on T044, T045, T046)

**Checkpoint**: All four user stories are independently functional; 68/68 tests passing across the full suite (feature 001 + feature 002), zero regression.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — establishes the regression baseline.
- **Foundational (Phase 2)**: Verification-only; depends on Phase 1.
- **User Story 1 (Phase 3)**: Depends on Foundational. Fully independent of US2/US3 (different files).
- **User Story 2 (Phase 4)**: Depends on Foundational. Fully independent of US1/US3 (different files).
- **User Story 3 (Phase 5)**: Depends on Foundational. Fully independent of US1/US2 (touches only `schema.ts` and the existing feature-001 test file).
- **Polish (Phase 6)**: Depends on US1 and US2 (T029 needs both classes to exist); T031/T037 depend on all three stories being complete.
- **User Story 4 (Phase 7)**: Depends on US1, US2, and (for its `GroundedCall` change) the Foundational base — it touches `core/GroundedCall.ts`/`core/types.ts` (shared, previously unchanged by this feature) plus all three generator classes, so it necessarily comes after US1/US2/US3 exist.

### User Story Dependencies

- **US1 (P1)**: Independent — new files only (`GroundedEnricher.ts`, `GroundedEnricher.schema.ts`, its test files).
- **US2 (P1)**: Independent — new files only (`GroundedExtractor.ts`, `GroundedExtractor.schema.ts`, its test files).
- **US3 (P3)**: Independent — touches only `src/generators/schema.ts` and the existing `GroundedGenerator.schema.test.ts`.
- **US4 (P2)**: Depends on US1/US2/US3 (or at least US1/US2) already existing — it's the only story that touches shared `core/` files plus all three generator files. Not parallelizable with the others in practice.

Unlike feature 001 (where US1/US2 shared one file), US1/US2/US3 here touch **disjoint
files** and can be implemented fully in parallel by up to three developers. US4 is the
exception — it's inherently cross-cutting and must come after the others.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Schema before class implementation.
- Class implementation before result-mapping branches.

### Parallel Opportunities

- T003 (US1 contract test) and T014/T015 (US2 tests) can run in parallel with each other (different files); T004-T007 are sequential (same US1 test file), T016-T019 are sequential (same US2 test file).
- US1, US2, and US3 can be worked on entirely in parallel by different developers (disjoint files) — a first for this project, since feature 001's US1/US2 could not be parallelized.
- Polish tasks T030, T032, T033, T034, T035, T036 can all run in parallel (different files), once their prerequisite story is done.

---

## Parallel Example: All Three User Stories

```bash
# Once Foundational (Phase 2) is done, launch all three stories together:
Task: "US1 — Implement GroundedEnricher (T003-T013)"
Task: "US2 — Implement GroundedExtractor (T014-T025)"
Task: "US3 — Adjust GroundedGenerator schema descriptions (T026-T028)"
```

---

## Implementation Strategy

### MVP First

Given all three stories are independent and P1/P1/P3, there is no single "MVP" the way feature 001 had one — ship whichever story is most urgently needed first, or all three together since they don't conflict.

### Incremental Delivery

1. Setup + Foundational → baseline confirmed.
2. Add US1 (`GroundedEnricher`) → validate independently → ship.
3. Add US2 (`GroundedExtractor`) → validate independently → ship.
4. Add US3 (`GroundedGenerator` schema descriptions) → validate no regression → ship.
5. Polish (exports, README, evaluations, build).

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: US1 (`GroundedEnricher`)
- Developer B: US2 (`GroundedExtractor`)
- Developer C: US3 (schema description adjustment)

All three integrate independently in Polish (T029 onward).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- `GroundedExtractor`'s config/result types are generic over the developer-provided `fields` shape — keep them in `GroundedExtractor.ts` rather than polluting `core/types.ts`, since they are not shared with `GroundedGenerator`/`GroundedEnricher` (per plan.md's Structure Decision).

---

description: "Task list for feature implementation"
---

# Tasks: GroundedGenerator

**Input**: Design documents from `/specs/001-grounded-generator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/GroundedGenerator.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires schema tests and behavior tests with a mocked OpenAI client written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md:

- `src/core/`, `src/generators/`, `src/index.ts`
- `tests/unit/`, `tests/contract/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure: `src/core/`, `src/generators/`, `tests/unit/core/`, `tests/unit/generators/`, `tests/contract/generators/`
- [X] T002 Initialize `package.json` (ESM `type: module`) with dependencies `zod`, `openai`, and devDependencies `typescript`, `tsup`, `vitest`, `@types/node`
- [X] T003 [P] Configure `tsconfig.json` (strict mode, `target: ES2022`, `module: NodeNext`)
- [X] T004 [P] Configure `tsup.config.ts` for dual ESM+CJS build with entry `src/index.ts`
- [X] T005 [P] Configure `vitest.config.ts` to run tests under `tests/`

**Checkpoint**: Toolchain builds and runs an empty test suite before any feature code exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared base class, types, and error/guard machinery that every user story's implementation depends on. Reusable later by `GroundedDecider` (out of scope here, per plan.md).

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T006 [P] Define shared types in `src/core/types.ts`: `GroundedCallConfig` (`apiKey?`, `model?`, `fallbackValue`, `temperature?`, `maxContextTokens?`, `client?` — an optional pre-configured `openai` client instance) and `GroundedCallResult` (`finalAnswer`, `usedFallback`, `extractedFacts`, `reasoning`), per data-model.md
- [X] T007 [P] Implement token-estimation utility in `src/core/contextWindow.ts`: estimate prompt tokens for a given model, expose known per-model default limits, and apply a safety margin below the model's exact limit (not the exact boundary), per research.md decision on FR-011
- [X] T008 [P] Define `OperationalError` types in `src/core/errors.ts`: `ModelUnavailableError` (FR-010), `ContextTooLargeError` (FR-011), and `InvalidModelOutputError` (FR-012) — all distinct from a normal `GroundedCallResult` and from each other
- [X] T009 Implement `GroundedCall` abstract base class in `src/core/GroundedCall.ts`: validates `fallbackValue` is provided at construction and throws immediately if missing (FR-005); validates any other required/malformed config field (e.g., an empty `model` string when `client` is not provided) and throws immediately at construction, before any generation call (FR-005); when `config.client` is provided, use that `openai` instance as-is (FR-008); otherwise resolve `apiKey` default from `OPENAI_API_KEY`, `model` default `"gpt-4o-mini"`, `temperature` default `0`, and instantiate a new `openai` client internally (depends on T006)
- [X] T010 Implement context-overflow guard in `src/core/GroundedCall.ts`: before calling the model, use `contextWindow.ts` to estimate tokens (with its safety margin) and throw `ContextTooLargeError` when the estimate exceeds `maxContextTokens`, without truncating (FR-011) (depends on T007, T008, T009)
- [X] T011 Implement technical-failure handling in `src/core/GroundedCall.ts`: wrap the `openai.chat.completions.create` call and rethrow communication/availability failures as `ModelUnavailableError`, kept distinct from `ContextTooLargeError`, `InvalidModelOutputError`, and from a successful `GroundedCallResult` (FR-010) (depends on T008, T009)
- [X] T012 Implement invalid-output guard in `src/core/GroundedCall.ts`: after a technically successful call, detect a response that fails structured-output schema validation or is refused by the model, and throw `InvalidModelOutputError`, kept distinct from `ModelUnavailableError` and `ContextTooLargeError` (FR-012); the component MUST NOT retry automatically in any of these three error cases (depends on T008, T011)
- [X] T013 [P] Unit tests for `GroundedCall` construction/config validation in `tests/unit/core/GroundedCall.test.ts`: missing `fallbackValue` rejected; other malformed required fields (e.g., empty `model` when `client` is omitted) also rejected immediately; `apiKey`/`model`/`temperature` defaults applied correctly when `client` is omitted; a provided `config.client` is used directly instead of constructing a new `openai` instance (FR-005, FR-008)
- [X] T014 [P] Unit tests for the context-overflow, technical-failure, and invalid-output guards in `tests/unit/core/GroundedCall.test.ts`: `ContextTooLargeError` raised (respecting the safety margin) without calling `openai.chat.completions.create`; `ModelUnavailableError` raised when the mocked client rejects; `InvalidModelOutputError` raised when the mocked response fails schema validation or is refused; all three distinguishable from each other and asserted to never trigger an automatic retry (FR-010, FR-011, FR-012)

**Checkpoint**: Foundation ready — `GroundedCall` base class is fully tested and user story implementation can begin.

---

## Phase 3: User Story 1 - Resposta ancorada quando o contexto é suficiente (Priority: P1) 🎯 MVP

**Goal**: When the provided context contains the information needed, extract literal supporting excerpts, confirm sufficiency, and generate a final answer derived exclusively from those excerpts.

**Independent Test**: Call the component with a (context, question) pair where the context contains the answer; verify `usedFallback = false`, `extractedFacts` is non-empty, and `finalAnswer` only uses information present in `extractedFacts`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T015 [P] [US1] Contract test for the structured output schema (`extracted_facts: string[]`, `sufficient_context: boolean`, `reasoning: string`, `final_answer: string` via `zodResponseFormat` with `strict: true`) in `tests/contract/generators/GroundedGenerator.schema.test.ts`
- [X] T016 [P] [US1] Unit tests for the sufficient-context happy path in `tests/unit/generators/GroundedGenerator.test.ts`: mocked `openai.chat.completions.create` returns `sufficient_context: true`; assert `usedFallback = false`, `extractedFacts` non-empty, `finalAnswer` traceable to `extractedFacts`, `reasoning` present; assert the request sent to the client uses `temperature: 0` by default (FR-009)
- [X] T017 [US1] Unit test for an empty/missing `question` in `tests/unit/generators/GroundedGenerator.test.ts`: asserts the call is rejected immediately as invalid usage and `openai.chat.completions.create` is never invoked, distinct from the context-insufficiency fallback path (depends on T016)

### Implementation for User Story 1

- [X] T018 [US1] Define the Zod output schema and its `zodResponseFormat` conversion in `src/generators/GroundedGenerator.ts` (depends on T006)
- [X] T019 [US1] Implement the `GroundedGenerator` class extending `GroundedCall` in `src/generators/GroundedGenerator.ts`: builds the prompt instructing literal fact extraction, an explicit sufficiency decision, and a grounded answer; calls `openai.chat.completions.create` with the schema's `response_format` and the configured `temperature` (depends on T009, T018)
- [X] T020 [US1] Implement the sufficient-context result mapping in `src/generators/GroundedGenerator.ts`: when `sufficient_context = true`, map to `GroundedCallResult` with `finalAnswer: final_answer`, `usedFallback: false`, `extractedFacts: extracted_facts`, `reasoning` (depends on T019)
- [X] T021 [US1] Wire the context-overflow, technical-failure, and invalid-output guards (T010, T011, T012) into `GroundedGenerator`'s generation call in `src/generators/GroundedGenerator.ts` (depends on T010, T011, T012, T019)
- [X] T022 [US1] Implement empty/missing-`question` validation in `src/generators/GroundedGenerator.ts`: reject immediately as invalid usage, before calling the model (depends on T019)

**Checkpoint**: User Story 1 is fully functional and testable independently — this is the MVP.

---

## Phase 4: User Story 2 - Fallback quando o contexto é insuficiente (Priority: P1)

**Goal**: Never fabricate an answer. When the context is insufficient, or no relevant excerpt can be extracted, return the developer-configured `fallbackValue` with `usedFallback = true`.

**Independent Test**: Call the component with questions whose context lacks the needed information; verify the result equals the configured fallback with `usedFallback = true`, instead of a generated answer.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation. These tasks all touch the shared test file from US1 and therefore run sequentially, not in parallel with each other.

- [X] T023 [US2] Unit test for the insufficient-context fallback path in `tests/unit/generators/GroundedGenerator.test.ts`: mocked response with `sufficient_context: false` asserts `usedFallback = true` and `finalAnswer === fallbackValue` (depends on T016)
- [X] T024 [US2] Unit test for empty/blank `context` short-circuiting to fallback in `tests/unit/generators/GroundedGenerator.test.ts`: asserts `openai.chat.completions.create` is never called and the result is the fallback (depends on T023)
- [X] T025 [US2] Unit test asserting that zero `extracted_facts` on a non-empty context still triggers fallback, even when the model marks `sufficient_context: true` in error, per FR-004 (depends on T023)
- [X] T026 [US2] Unit test for contradictory context (two excerpts disagreeing on the same fact) being treated as insufficient and triggering fallback in `tests/unit/generators/GroundedGenerator.test.ts` (depends on T023)

### Implementation for User Story 2

- [X] T027 [US2] Implement the empty/blank-`context` short-circuit in `src/generators/GroundedGenerator.ts`: skip the model call entirely and return the fallback result directly (Edge Case rule) (depends on T019) — *already implemented as part of T019's single-call design; verified by T024.*
- [X] T028 [US2] Implement the fallback-mapping branch in `src/generators/GroundedGenerator.ts`: when `sufficient_context = false`, or `extracted_facts` is empty, map to `GroundedCallResult` with `finalAnswer: fallbackValue`, `usedFallback: true` (depends on T020) — *already implemented as part of T020's single-call design; verified by T023/T025.*
- [X] T029 [US2] Add prompt guidance in `src/generators/GroundedGenerator.ts` instructing the model to treat internally contradictory context as insufficient rather than attempting to resolve the contradiction (depends on T019) — *already present in `SYSTEM_PROMPT`; verified by T026.*

**Checkpoint**: User Stories 1 AND 2 both work independently — the core anti-hallucination behavior is complete.

---

## Phase 5: User Story 3 - Integração sem reescrever a lógica de retrieval existente (Priority: P2)

**Goal**: A developer with an existing retrieval pipeline can adopt the component as a plain function, without adapting to any third-party orchestration types (LangChain, LangGraph, or otherwise).

**Independent Test**: Configure the component and call it with `context`/`question` already produced by an existing retrieval flow, confirming no changes are required to that flow.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Integration test in `tests/unit/generators/GroundedGenerator.integration.test.ts` simulating a pipeline-produced `context` (e.g., a stubbed LangGraph-style node) calling `GroundedGenerator` with plain strings only, asserting no third-party orchestration type is required by the constructor or the call signature; also covers spec.md US3 Acceptance Scenario 2 by constructing `GroundedGenerator` with a pre-configured `openai` client instance (mocked) passed as `config.client` and asserting that instance is used instead of one created internally (FR-008)

### Implementation for User Story 3

- [X] T031 [US3] Export `GroundedGenerator` and the shared types (`GroundedCallConfig`, `GroundedCallResult`) as the public API in `src/index.ts` (depends on T006, T019)
- [X] T032 [US3] Verify and document zero LangChain/orchestration-framework dependency in `package.json` (no `@langchain/*` dependency), confirming the standalone integration model from plan.md/research.md

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect the whole feature, after all user stories are complete.

- [X] T033 [P] Add a usage example (construction + generate call) to `README.md`
- [X] T034 Run all 4 `quickstart.md` validation scenarios end-to-end against the implementation — Cenário 1 (GroundedGenerator.test.ts happy path), Cenário 2 (GroundedGenerator.test.ts fallback tests), Cenário 3 (GroundedGenerator.integration.test.ts), Cenário 4 (GroundedCall.test.ts guards) — all passing (31/31 tests, `npm run build` succeeds)
- [X] T035 [P] Add publishing metadata to `package.json` (`version`, `exports` map for ESM/CJS, `files`)
- [X] T036 Build verification: `npm run build` produces ESM+CJS output in `dist/` without errors, and `npm test` passes fully
- [X] T037 [P] Build a fixed evaluation set of at least 20 (context, question) pairs with knowingly insufficient context (empty, off-topic, partially related, and contradictory cases) in `tests/unit/generators/GroundedGenerator.fallbackRate.evaluation.test.ts`, mocking `openai.chat.completions.create` per case; run `GroundedGenerator` against every pair and assert the fallback rate is >= 95% (SC-001), failing the test if the measured rate is below target
- [X] T038 [P] Build a fixed evaluation set of at least 20 (context, question) pairs with sufficient context in `tests/unit/generators/GroundedGenerator.traceability.evaluation.test.ts`, mocking `openai.chat.completions.create` per case; for each result, assert every sentence/claim in `finalAnswer` is derivable from `extractedFacts` (e.g., each key term/phrase used in `finalAnswer` also appears in at least one entry of `extractedFacts`) and assert this holds for 100% of the set (SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational completion. Builds on the same `src/generators/GroundedGenerator.ts` and its test file introduced in US1 — see note below.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and on `GroundedGenerator` existing (from US1) to export it; otherwise independent of US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independently testable after Foundational. This is the MVP.
- **User Story 2 (P1)**: Logically independent (per spec.md), but implemented in the same file (`src/generators/GroundedGenerator.ts`) and test file as US1, since both are branches of the same single structured-output call. In practice, complete US1 first, then US2 — they cannot be split across two developers working in parallel without conflicting on the same file.
- **User Story 3 (P2)**: Mostly independent; only needs `GroundedGenerator` to exist (from US1) to export and validate it, without requiring US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Types/schema before class implementation.
- Class implementation before result-mapping branches.
- Story complete before moving to the next priority.

### Parallel Opportunities

- Setup tasks T003, T004, T005 can run in parallel (different config files).
- Foundational tasks T006, T007, T008 can run in parallel (different files); T009–T014 are sequential (same file / dependent).
- T015 and T016 (US1 tests) touch different files and can run in parallel; T017 depends on T016 (same file).
- US2 tests (T023–T026) and US2/US1 implementation all touch `src/generators/GroundedGenerator.ts` or its single test file — sequential, not parallel.
- US3's test (T030) is a separate file and can run in parallel with other work once `GroundedGenerator` exists.
- Polish tasks T033, T035, T037, T038 can run in parallel (different files).

---

## Parallel Example: Foundational Phase

```bash
# Launch independent foundational files together:
Task: "Define shared types in src/core/types.ts"
Task: "Implement token-estimation utility in src/core/contextWindow.ts"
Task: "Define OperationalError types in src/core/errors.ts"
```

## Parallel Example: User Story 1

```bash
# Launch US1 tests together (different files):
Task: "Contract test for structured output schema in tests/contract/generators/GroundedGenerator.schema.test.ts"
Task: "Unit tests for sufficient-context happy path in tests/unit/generators/GroundedGenerator.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run quickstart.md Cenário 1 independently.
5. Ship the MVP: anchored answers with no fallback logic yet exercised beyond the base guard rails.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → validate independently → MVP.
3. Add User Story 2 → validate independently (fallback behavior complete — this is when the anti-hallucination guarantee is fully in place).
4. Add User Story 3 → validate independently (standalone/pluggable integration confirmed).
5. Polish.

### Team Strategy Note

Unlike typical multi-story features, US1 and US2 share a single implementation file and cannot be parallelized across two developers without conflict — plan for one developer (or a strict hand-off) across Phases 3–4. US3 (Phase 5) can be picked up by a second developer once `GroundedGenerator`'s class shape (from US1) is agreed upon.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- `core/GroundedCall.ts` and `core/types.ts` are intentionally reusable by a future `GroundedDecider` feature (out of scope here, per plan.md), so avoid adding anything `GroundedGenerator`-specific to those two files.
- None of the three `OperationalError` types (`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`) trigger an automatic retry — retry policy is the consuming developer's responsibility (spec.md Assumptions).

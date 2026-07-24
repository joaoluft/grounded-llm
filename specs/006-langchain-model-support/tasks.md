---

description: "Task list for feature implementation"
---

# Tasks: Suporte a modelo LangChain no GroundedCall (tracing LangSmith)

**Input**: Design documents from `/specs/006-langchain-model-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/langchain-model-support.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires behavior tests written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md. Most of the change lives in `src/core/` (two
new files, two adjusted), plus `package.json` and `tests/unit/core/`.
`src/generators/grounded-extractor.ts` also needs a small type-only adjustment,
because its `GroundedExtractionConfig` is a standalone interface that duplicates
`GroundedCallConfig`'s fields instead of extending it (same situation feature
`004-behavioral-tone-field` handled for `tone`) — see `/speckit-analyze` finding E1.

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since SC-002 requires zero regression on any existing standalone behavior.

- [X] T001 Run the full existing test suite (`npm test`) and record it passing as the regression baseline before any change in this feature
- [X] T002 [P] Add `@langchain/core` to `package.json`: `peerDependencies` with a caret range compatible with the current LangChain major, `peerDependenciesMeta["@langchain/core"].optional = true`, and as a `devDependency` (for build/type-check/tests of this package only) — run `npm install` after editing

**Checkpoint**: Baseline confirmed green; `@langchain/core` resolvable for dev/test use, not required by consumers.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the existing OpenAI call logic behind a `ModelClient` abstraction (behavior-preserving refactor) and add the `langchainModel` field to **both** config types (`GroundedCallConfig` and `GroundedExtractionConfig`), without wiring any new behavior yet — every user story depends on this shared plumbing, and every one of the three components needs the field to actually exist on the config type it accepts.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

### Tests for Foundational ⚠️

> Write these tests FIRST; ensure they FAIL before implementation (or pass trivially against current behavior, then keep passing after the refactor).

- [X] T003 [P] Regression-anchor test in `tests/unit/core/grounded-call.test.ts`: a `GroundedCall` subclass built without `langchainModel` (existing `client`/`apiKey` config) still calls `client.beta.chat.completions.parse` exactly as before, now exercised indirectly through the (not-yet-existing) `ModelClient` abstraction (FR-010)

### Implementation for Foundational

- [X] T004 Create `src/core/model-client.ts`: define the internal `ModelClient` interface (single `parse(params)` method, same params/return shape `callModel` uses today) and `OpenAiModelClient`, extracting the exact logic currently inline in `GroundedCall.callModel` (call to `client.beta.chat.completions.parse`, `LengthFinishReasonError`/`ContentFilterFinishReasonError`/refusal handling) — no behavior change (depends on T003)
- [X] T005 Update `src/core/grounded-call.ts`: `callModel` now delegates to `this.modelClient.parse(params)`; constructor instantiates `OpenAiModelClient` by default (current behavior unchanged); run T003 to confirm no regression (depends on T004)
- [X] T006 [P] Add `langchainModel?: BaseChatModel` (type-only, `import type { BaseChatModel } from '@langchain/core/language_models/chat_models'`) to `GroundedCallConfig` in `src/core/types.ts`, documented as mutually exclusive with `client`/`apiKey`/`model`/`temperature` — not yet read anywhere (depends on T002)
- [X] T007 [P] Add the same `langchainModel?: BaseChatModel` field, with the same documentation, to `GroundedExtractionConfig` in `src/generators/grounded-extractor.ts` — this interface does **not** extend `GroundedCallConfig` (it duplicates `client`/`apiKey`/`model`/`temperature`/etc.), so without this task `GroundedExtractor` cannot accept `langchainModel` at all (FR-001, FR-011 — fixes analysis finding E1) (depends on T002)

**Checkpoint**: `ModelClient` abstraction in place, full suite still green, both config types accept `langchainModel` (unused so far) — user story implementation can begin.

---

## Phase 3: User Story 1 - Usar um chat model LangChain já configurado para manter o tracing do LangSmith (Priority: P1) 🎯 MVP

**Goal**: A developer configuring any of the three components with `langchainModel` gets their calls routed through that chat model instead of a native OpenAI client.

**Independent Test**: Construct `GroundedGenerator` with a fake LangChain chat model (no `client`/`apiKey`/`model`/`temperature`); call `generate(...)`; verify the fake chat model's `withStructuredOutput(...).invoke(...)` was called and no OpenAI client was created or used. Repeat for `GroundedEnricher` and `GroundedExtractor` (FR-011).

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T008 [P] [US1] Unit tests in new `tests/unit/core/langchain-model-client.test.ts`, using a minimal fake chat model (implements `withStructuredOutput(schema, opts).invoke(messages)`): `LangChainModelClient.parse(params)` (a) extracts `params.response_format.json_schema.schema`/`.name` and passes them to `withStructuredOutput`; (b) converts `params.messages` (`{role, content}[]`) into LangChain tuple format (`[[role, content], ...]`) before calling `.invoke(...)`; (c) returns a result shaped like `{ choices: [{ message: { parsed, refusal: null } }] }` where `parsed` is whatever the fake's `invoke` resolved to (FR-002, research.md R1/R2)
- [X] T009 [US1] Unit tests in `tests/unit/core/grounded-call.test.ts`: (a) a `GroundedCall` subclass built with `langchainModel: <fake chat model>` only routes its call through the fake (not through any `OpenAiModelClient`/OpenAI client); (b) when `maxContextTokens` is omitted in this mode, the effective limit used for the context-size check is 128 000 tokens; (c) when `maxContextTokens` is provided explicitly together with `langchainModel`, that value is respected instead of the 128k default (FR-002, FR-004, FR-005)
- [X] T010 [P] [US1] Unit test in `tests/unit/generators/grounded-enricher.test.ts`: `GroundedEnricher` constructed with a fake `langchainModel` routes its call through the fake (FR-011 — fixes analysis finding E2)
- [X] T011 [P] [US1] Unit test in `tests/unit/generators/grounded-extractor.test.ts`: `GroundedExtractor` constructed with a fake `langchainModel` (via `GroundedExtractionConfig`) routes its call through the fake (FR-001, FR-011 — depends on T007; fixes analysis finding E1/E2)

### Implementation for User Story 1

- [X] T012 [US1] Create `src/core/langchain-model-client.ts` implementing `LangChainModelClient` (implements `ModelClient`): happy-path only — extract schema/name from `response_format`, convert messages to tuples, call `langchainModel.withStructuredOutput(schema, { name }).invoke(messages)`, package the result into the shape `callModel` expects (depends on T008)
- [X] T013 [US1] Update `src/core/grounded-call.ts` constructor: when `config.langchainModel` is provided, instantiate `LangChainModelClient` instead of `OpenAiModelClient`, and set `this.maxContextTokens` to `config.maxContextTokens ?? 128_000` in this mode (skipping `getMaxContextTokens(this.model)`, since there is no OpenAI `model` id to look up) (depends on T006, T012, T009)

**Checkpoint**: User Story 1 is fully functional and testable independently — `langchainModel` is usable end-to-end for the happy path across all three components; standalone mode unaffected.

---

## Phase 4: User Story 2 - Resultado estruturado idêntico independente do backend usado (Priority: P1)

**Goal**: For an equivalent model response, the result returned by any component (and the operational errors it can throw) is identical in shape and semantics between standalone and LangChain mode — including the existing optional composition fields (`identity`/`rules`/`tone`/`fallbackValue`).

**Independent Test**: Configure the same component twice — once in standalone mode (mocked OpenAI client), once in LangChain mode (fake chat model) — with equivalent structured outputs and the same `identity`/`rules`/`tone`/`fallbackValue` config; verify the returned `GroundedCallResult`/`GroundedExtractionResult` matches in both. Then make each mode fail equivalently (call error, invalid output) and verify the same error types are thrown.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T014 [P] [US2] Unit test in `tests/unit/generators/grounded-generator.test.ts`: given equivalent mocked structured outputs, `GroundedGenerator.generate(...)` returns the exact same `GroundedCallResult` shape and values whether configured in standalone mode or in LangChain mode (FR-006, SC-003)
- [X] T015 [P] [US2] Unit tests in `tests/unit/core/langchain-model-client.test.ts`: (a) when the fake chat model's `invoke(...)` rejects, `LangChainModelClient.parse(...)` throws `ModelUnavailableError`; (b) when `invoke(...)` resolves but the result is `null`/`undefined`/otherwise not usable as parsed output, it throws `InvalidModelOutputError` — mirroring `OpenAiModelClient`'s existing mapping (FR-007, FR-008)
- [X] T016 [P] [US2] Unit test in `tests/unit/core/grounded-call.test.ts`: a component configured with `langchainModel` **and** `identity`/`rules`/`tone`/`fallbackValue` composes the system prompt and applies the fallback exactly as it would in standalone mode — these fields are backend-agnostic (FR-009 — fixes analysis finding E4)

### Implementation for User Story 2

- [X] T017 [US2] Add error handling to `src/core/langchain-model-client.ts`: wrap `invoke(...)` failures as `ModelUnavailableError`, and treat a missing/invalid parsed result as `InvalidModelOutputError`, reusing the same error classes from `src/core/errors.ts` (no new error type introduced) (depends on T015)

**Checkpoint**: Result format and operational-error semantics are identical between the two modes; existing optional fields are unaffected by the backend used.

---

## Phase 5: User Story 3 - Configuração inválida é rejeitada de forma clara (Priority: P2)

**Goal**: Configuring `langchainModel` together with any of `client`/`apiKey`/`model`/`temperature` fails fast with a clear configuration error, instead of silently picking one mode.

**Independent Test**: Construct any of the three components with `langchainModel` and, simultaneously, `client` (or `apiKey`, `model`, or `temperature`); verify construction throws immediately with a message explaining the two modes are mutually exclusive.

### Tests for User Story 3 ⚠️

> Write this test FIRST; ensure it FAILS before implementation.

- [X] T018 [P] [US3] Unit tests in `tests/unit/core/grounded-call.test.ts`: constructing a `GroundedCall` subclass with `langchainModel` combined with each of `client`, `apiKey`, `model`, and `temperature` (one case per field) throws a configuration error immediately, before any model call is attempted (FR-003, SC-004)

### Implementation for User Story 3

- [X] T019 [US3] Add a mutual-exclusivity check at the top of the `GroundedCall` constructor in `src/core/grounded-call.ts`: throw a descriptive `Error` when `config.langchainModel` is present together with any of `config.client`, `config.apiKey`, `config.model`, or `config.temperature` (depends on T018)

**Checkpoint**: All three user stories are independently functional — `langchainModel` works end-to-end, results/errors are consistent with standalone mode, and invalid combinations are rejected clearly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation, after all user stories are complete.

- [X] T020 [P] Update `README.md` (both Português and English sections): document `langchainModel` as an alternative to `client`/`apiKey` for keeping LangSmith tracing, note the mutual-exclusivity rule, the 128k default context limit in this mode, and that `@langchain/core` is an optional peer dependency (depends on T019)
- [X] T021 Run all 7 `quickstart.md` validation scenarios end-to-end against the implementation
- [X] T022 Build verification: `npm run build` succeeds and `npm test` passes fully (all prior features' tests + this feature's new tests, zero regressions); additionally confirm `@langchain/core` does not get installed by a plain `npm install` of this package in a clean consumer project (peerDependency + optional meta, per SC-005 — fixes analysis finding E3)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — establishes the regression baseline and the optional peer/dev dependency.
- **Foundational (Phase 2)**: Depends on Phase 1. BLOCKS all user stories — every story depends on the `ModelClient` abstraction and the `langchainModel` config field existing on **both** `GroundedCallConfig` and `GroundedExtractionConfig`.
- **User Story 1 (Phase 3)**: Depends on Foundational. Delivers the MVP (dispatch to LangChain, all three components).
- **User Story 2 (Phase 4)**: Depends on Foundational and on `LangChainModelClient` existing (T012 from US1) — adds error mapping and result-parity tests/implementation on top of it.
- **User Story 3 (Phase 5)**: Depends on Foundational only (the config types from T006/T007) — independent of US1/US2 implementation, touches only the constructor's validation, not the adapter.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent of US2/US3 for its own delivery, but US2 builds directly on the file US1 creates (`langchain-model-client.ts`).
- **US2 (P1)**: Extends `LangChainModelClient` (from US1) with error handling — sequenced after US1's T012, but its tests/goal are independently verifiable (result/error parity).
- **US3 (P2)**: Independent of US1/US2 — only touches the constructor's guard clause in `grounded-call.ts`; can be implemented in parallel with US1/US2 by a different developer once Foundational is done.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Foundational (`ModelClient` extraction + `langchainModel` field on both config types) before any user story work.

### Parallel Opportunities

- T002 (package.json) and T003 (regression-anchor test) can run in parallel.
- T006 and T007 (Foundational config-type additions, different files) can run in parallel.
- T010 and T011 (US1 enricher/extractor dispatch tests, different files) can run in parallel with T008/T009.
- Once Foundational (Phase 2) is done, **US3 (T018-T019)** can be implemented fully in parallel with **US1 (T008-T013) → US2 (T014-T017)** by a different developer, since US3 only touches the constructor's guard clause while US1/US2 build out the adapter.
- T014, T015, T016 (US2 tests, different files) can be written in parallel.

---

## Parallel Example: User Story 1+2 and User Story 3

```bash
# Once Foundational (Phase 2) is done, launch both independent tracks together:
Task: "US1+US2 — LangChainModelClient adapter, dispatch (3 components), result/error parity (T008-T017)"
Task: "US3 — mutual-exclusivity guard in GroundedCall constructor (T018-T019)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (`langchainModel` dispatch, happy path, all three components).
4. **STOP and VALIDATE**: run T008-T011 independently; this alone lets a developer route calls through a LangChain chat model and get LangSmith tracing on the happy path, on any of the three components.

### Incremental Delivery

1. Setup + Foundational → `ModelClient` abstraction in place, no behavior change; both config types accept `langchainModel`.
2. Add US1 (dispatch to `langchainModel`, all three components) → validate independently → ship.
3. Add US2 (result/error parity, including existing optional fields) → validate independently → ship.
4. Add US3 (mutual-exclusivity guard) → validate independently → ship.
5. Polish (README, quickstart, build, dependency-footprint check).

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: US1 → US2 (`langchain-model-client.ts`, sequential — US2 extends what US1 creates)
- Developer B: US3 (`grounded-call.ts` constructor guard, independent file section)

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- No change in `src/generators/grounded-generator.ts`/`grounded-enricher.ts`, and no change in `callModel`'s public signature — the bulk of the feature is internal to `src/core/` (see research.md R6). `grounded-extractor.ts` needs one type-only field addition, since its config doesn't extend `GroundedCallConfig` (see Path Conventions above).
- The 128k default context limit (FR-004), the mutual-exclusivity guard (FR-003), and the per-component consistency (FR-011) are the pieces of "policy" this feature adds beyond wiring the adapter; all are covered by dedicated tests (T009, T018, T010/T011).

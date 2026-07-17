---

description: "Task list for feature implementation"
---

# Tasks: GroundedComposer

**Input**: Design documents from `/specs/007-grounded-composer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/grounded-composer.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires schema tests and behavior tests with a mocked model client written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md — reuses `src/core/` unchanged; new files under
`src/generators/`, `tests/unit/generators/`, `tests/contract/generators/`, following the
kebab-case file naming already established (feature 005).

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since SC-004/FR-714 require zero regression on the existing generators.

- [X] T001 Run the full existing test suite (`npm test`) and record it passing as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the shared base needs no changes for this feature — `GroundedComposer` reuses it as-is.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete (trivial here, since nothing in `core/` changes).

- [X] T002 Confirm `src/core/grounded-call.ts`, `src/core/types.ts`, `src/core/errors.ts`, and `src/core/context-window.ts` require no modification for `GroundedComposer` (reuses `GroundedCall`, `GroundedCallConfig`, `GroundedCallResult`, error types unchanged, per research.md) — verification-only task, no code change

**Checkpoint**: Foundation confirmed reusable; user story implementation can begin.

---

## Phase 3: User Story 1 - Compor uma mensagem seguindo instruções obrigatórias, sem abstenção (Priority: P1)

**Goal**: `GroundedComposer` always produces a final message derived from `instructions`, never abstaining or falling back to a generic response.

**Independent Test**: Call the component with `instructions` describing a specific question to ask and no `context`; verify the returned message follows the instructions and `usedFallback` is always `false`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T003 [P] [US1] Contract test for the composition structured output schema (`applied_rules: string[]`, `context_used: boolean`, `context_excerpts: string[]`, `reasoning: string`, `final_message: string` via `zodResponseFormat` with `strict: true`) in `tests/contract/generators/grounded-composer.schema.test.ts`
- [X] T004 [P] [US1] Unit test for the happy path with `instructions` only (no `context`) in `tests/unit/generators/grounded-composer.test.ts`: mocked response asserts `usedFallback = false`, `finalAnswer` follows `instructions`, `extractedFacts` contains the mocked `applied_rules`, `reasoning` present, `temperature: 0` sent by default
- [X] T005 [US1] Unit test asserting `GroundedComposer` never returns an empty `finalAnswer` or `usedFallback = true` across varied mocked `applied_rules`/`final_message` combinations in `tests/unit/generators/grounded-composer.test.ts` (depends on T004)
- [X] T006 [US1] Unit test for empty/blank `instructions` in `tests/unit/generators/grounded-composer.test.ts`: asserts the call throws immediately as invalid usage (FR-703), matching the message-format convention of `GroundedGenerator`/`GroundedEnricher`, and the model is never called (depends on T004)
- [X] T007 [US1] Unit test confirming `GroundedComposer` ignores any `fallbackValue` passed via `GroundedCallConfig` — construct with `fallbackValue` set, call successfully, assert `usedFallback` is still always `false` and the configured value never appears in the result (depends on T004)

### Implementation for User Story 1

- [X] T008 [US1] Define the Zod output schema (`applied_rules`, `context_used`, `context_excerpts`, `reasoning`, `final_message`) and its `zodResponseFormat` conversion in `src/generators/grounded-composer.schema.ts`, per data-model.md
- [X] T009 [US1] Implement the `GroundedComposer` class extending `GroundedCall` in `src/generators/grounded-composer.ts`: builds the prompt instructing literal extraction from `instructions` as the mandatory source, composing `final_message` strictly from those instructions; calls the model with the schema's `response_format` and configured `temperature` (depends on T008)
- [X] T010 [US1] Implement empty/blank-`instructions` validation in `src/generators/grounded-composer.ts`: reject immediately as invalid usage, before calling the model (FR-703) (depends on T009)
- [X] T011 [US1] Implement the result mapping in `src/generators/grounded-composer.ts` per data-model.md: `finalAnswer` ← `final_message`, `usedFallback` ← always `false`, `reasoning` ← `reasoning` — no sufficiency gate, no fallback branch (FR-705) (depends on T009)
- [X] T012 [US1] Wire the context-overflow, technical-failure, and invalid-output guards (reused from `GroundedCall`) into `GroundedComposer`'s composition call in `src/generators/grounded-composer.ts` (depends on T009)

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Usar dados de conversa como apoio, sem que a ausência deles bloqueie a resposta (Priority: P1)

**Goal**: `context` (optional) influences the composed message when relevant (conflict, progress, referenced data) but its absence or irrelevance never blocks or degrades the output.

**Independent Test**: Call the component with the same `instructions` in three scenarios — `context` present and relevant, `context` present but irrelevant, `context` absent — and verify a final message is always produced, with `context_used`/`context_excerpts` reflecting each scenario correctly.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T013 [P] [US2] Unit test for `context` present and relevant (e.g. conflicting business rule mentioned) in `tests/unit/generators/grounded-composer.test.ts`: mocked response with `context_used: true` asserts `extractedFacts` includes both `applied_rules` and `context_excerpts`, and `reasoning` connects the `context` excerpt to `finalAnswer` (depends on T004)
- [X] T014 [US2] Unit test for `context` present but irrelevant in `tests/unit/generators/grounded-composer.test.ts`: mocked response with `context_used: false` and empty `context_excerpts` asserts `extractedFacts` contains only `applied_rules`, and `finalAnswer` is produced normally (depends on T013)
- [X] T015 [US2] Unit test for `context` absent/empty/blank in `tests/unit/generators/grounded-composer.test.ts`: asserts the composition proceeds normally (no error, no short-circuit), the model is still called, and the result is based solely on `instructions` (FR-704) (depends on T013)

### Implementation for User Story 2

- [X] T016 [US2] Extend `ComposerRequest` in `src/generators/grounded-composer.ts` to accept optional `context`, normalizing missing/empty/blank values to "no conversation data" before building the prompt (FR-704) (depends on T009)
- [X] T017 [US2] Extend the prompt-building logic in `src/generators/grounded-composer.ts` to instruct the model to treat `context` (when present) strictly as supportive material for conflict detection, progress acknowledgment, or referencing already-mentioned data — never as a sufficiency gate (FR-707) (depends on T016)
- [X] T018 [US2] Extend the result mapping in `src/generators/grounded-composer.ts` so `extractedFacts` concatenates `applied_rules` with `context_excerpts` (in that order), per data-model.md (FR-708) (depends on T011, T017)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Rastrear a mensagem gerada até as instruções fornecidas (Priority: P2)

**Goal**: Every successful result is auditable — `applied_rules` traces `finalAnswer` back to `instructions`, and `reasoning` explains how `instructions` (and `context`, when used) led to the final message. `identity`/`rules`/`tone` composition (already built into `GroundedCall`) works unchanged for this new component.

**Independent Test**: Inspect the result of any successful call and confirm it always contains non-empty literal excerpts from `instructions` and an explicit reasoning trace; configure `identity`/`rules`/`tone` and confirm they appear in the system prompt in the established order.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] Unit test asserting `extractedFacts` (from `applied_rules`) is never empty across all mocked scenarios exercised in Phases 3-4 in `tests/unit/generators/grounded-composer.test.ts` (depends on T011)
- [X] T020 [US3] Unit test for `identity`/`rules`/`tone` composition in `tests/unit/generators/grounded-composer.test.ts`: construct `GroundedComposer` with all three configured, assert the system prompt sent to the model includes them as additional sections, in the same order already validated for `GroundedGenerator`/`GroundedEnricher` (built-in instructions → identity → rules → tone), reusing `GroundedCall.buildSystemPrompt()` unchanged (depends on T009)

### Implementation for User Story 3

- [X] T021 [US3] Confirm (and adjust if needed) that `GroundedComposer`'s system-prompt construction in `src/generators/grounded-composer.ts` calls `this.buildSystemPrompt(basePrompt)` exactly as the other generators do, requiring no changes to `buildSystemPrompt()` itself (depends on T009, T020)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Public API exposure, documentation, quickstart validation, and no-regression confirmation, after all user stories are complete.

- [X] T022 [US1] [US2] [US3] Export `GroundedComposer` (and `ComposerRequest`) as public API in `src/index.ts` (depends on T009, T016)
- [X] T023 [P] Add usage examples for `GroundedComposer` to `README.md` (both Português and English sections, per the existing bilingual structure), highlighting the inverted anchoring (instructions-first, no fallback) versus the other generators (depends on T022)
- [X] T024 Run all 7 `quickstart.md` validation scenarios end-to-end against the implementation
- [X] T025 Re-run the full existing test suite (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor` — unit, contract, evaluation) and confirm 100% pass with no behavior change (FR-714, SC-004)
- [X] T026 Build verification: `npm run build` succeeds and `npm test` passes fully (all pre-existing tests + all `GroundedComposer` tests)

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → User story phases (3, 4, 5) → **Phase 6 (Polish)**
- User Story 1 (Phase 3) has no dependency on US2/US3 and is independently shippable as the MVP.
- User Story 2 (Phase 4) extends `ComposerRequest`/prompt/result-mapping built in Phase 3 — depends on T009/T011, but is a strict extension (no rework of US1's tests).
- User Story 3 (Phase 5) is purely additive observability/composition coverage over what Phases 3-4 already implement — no new production code beyond confirming `buildSystemPrompt()` reuse.

## Parallel Execution Examples

- Within Phase 3: T003 and T004 can start in parallel (different files/independent mocks); T005-T007 depend on T004's mock scaffolding.
- Within Phase 4: T013 can start as soon as T004 lands, in parallel with any remaining Phase 3 polish; T014-T015 depend on T013.
- T019 (Phase 5) and T023 (Phase 6, README) can run in parallel with each other once their respective dependencies land.

## Suggested MVP Scope

**User Story 1 alone** (Phases 1-3) is a viable MVP: a `GroundedComposer` that always composes a message from `instructions`, never aborts/falls back, with full schema and behavior test coverage. User Story 2 (context support) and User Story 3 (traceability/personalization coverage) are incremental hardening on top of that MVP.

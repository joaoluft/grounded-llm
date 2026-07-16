---

description: "Task list for feature implementation"
---

# Tasks: Campo opcional de comportamento/tom para a família de generators

**Input**: Design documents from `/specs/004-behavioral-tone-field/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tone-composition.md, quickstart.md

**Tests**: Included. Constitution principle 7 (TDD estrito) requires behavior tests with a mocked OpenAI client written before implementation — tests are not optional for this feature.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every task description

## Path Conventions

Single project (library), per plan.md — reuses `src/generators/GroundedGenerator.ts`,
`GroundedEnricher.ts` unchanged (they already delegate to `buildSystemPrompt`);
changed files under `src/core/`, `src/generators/GroundedExtractor.ts`,
`tests/unit/core/`, `tests/unit/generators/`.

---

## Phase 1: Setup (Baseline)

**Purpose**: Establish a clean baseline before making any change, since SC-002 requires zero regression on any existing `identity`/`rules` behavior.

- [X] T001 Run the full existing test suite (`npm test`) and record it passing (79/79 from features 001+002+003) as the regression baseline before any change in this feature

**Checkpoint**: Baseline confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add `tone` to the shared config type and extend `buildSystemPrompt` to compose it — every user story depends on this, since both `GroundedGenerator`/`GroundedEnricher` (via `GroundedCallConfig`) and `GroundedExtractor` (via its own config, passed through to the same base method) rely on this single composition point.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

### Tests for Foundational ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T002 [P] Unit tests in `tests/unit/core/GroundedCall.test.ts` (new `describe` block, alongside the existing identity/rules composition tests): (a) `tone` alone is appended after the base prompt when configured; (b) `tone` as an empty/blank string is ignored — prompt unchanged from base; (c) when `identity`, `rules`, and `tone` are all configured together, they compose in the order `identity` → `rules` → `tone` after the base prompt (FR-002, FR-003, FR-005)

### Implementation for Foundational

- [X] T003 Add `tone?: string` to `GroundedCallConfig` in `src/core/types.ts`, documented the same way as `identity`/`rules` (depends on T002)
- [X] T004 Add `protected readonly tone?: string` to `GroundedCall`, set it from `config.tone` in the constructor, and extend `buildSystemPrompt` in `src/core/GroundedCall.ts` to append a `tone` section (trim-checked, treating blank as unconfigured) after the `rules` section, framed as complementing style without overriding the grounding instructions (depends on T003)

**Checkpoint**: `tone` is composed correctly by the shared base — user story implementation can begin.

---

## Phase 3: User Story 1 - Configurar o tom/personalidade da LLM para um cenário de chatbot (Priority: P1) 🎯 MVP

**Goal**: A developer configuring `GroundedGenerator` with a `tone` description (e.g. "seja empático e gentil") sees it reflected in the system prompt sent to the model, always after the component's built-in grounding instructions.

**Independent Test**: Construct `GroundedGenerator` with `tone` configured; call it; verify the system message sent to the mocked model contains the `tone` text, positioned after the built-in instructions.

### Tests for User Story 1 ⚠️

> Write this test FIRST; ensure it FAILS before implementation.

- [X] T005 [P] [US1] Unit test in `tests/unit/generators/GroundedGenerator.test.ts`: `GroundedGenerator` constructed with `tone: "seja empático e gentil"` → asserts the system message sent to the mocked model contains that text, positioned after the built-in instructions text (FR-001, FR-002)

### Implementation for User Story 1

- [X] T006 [US1] No production code change required in `src/generators/GroundedGenerator.ts` — it already delegates to `this.buildSystemPrompt(...)`, which now composes `tone` (Phase 2); run T005 to confirm this is sufficient (depends on T004, T005)

**Checkpoint**: User Story 1 is fully functional and testable independently — `GroundedGenerator` reflects `tone` in its system prompt.

---

## Phase 4: User Story 2 - Usar a mesma configuração de tom em qualquer componente da família (Priority: P2)

**Goal**: `tone` behaves identically across `GroundedEnricher` and `GroundedExtractor` too — same composition rule, same position relative to each component's own built-in instructions.

**Independent Test**: Construct `GroundedEnricher` and `GroundedExtractor`, each with the same `tone` text configured; call both; verify the system message sent to the mocked model contains that text in both cases, after each component's own built-in instructions.

### Tests for User Story 2 ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [X] T007 [P] [US2] Unit test in `tests/unit/generators/GroundedEnricher.test.ts`: `GroundedEnricher` constructed with `tone: "seja empático e gentil"` → asserts the system message sent to the mocked model contains that text, positioned after the built-in instructions text (FR-006)
- [X] T008 [P] [US2] Unit test in `tests/unit/generators/GroundedExtractor.test.ts`: `GroundedExtractor` constructed with `tone: "seja empático e gentil"` → asserts the system message sent to the mocked model contains that text, positioned after the built-in instructions text (FR-001, FR-006) — fails type-check before T010 (`tone` not yet declared on `GroundedExtractionConfig`)

### Implementation for User Story 2

- [X] T009 [US2] No production code change required in `src/generators/GroundedEnricher.ts` — it already delegates to `this.buildSystemPrompt(...)`; run T007 to confirm this is sufficient (depends on T004, T007)
- [X] T010 [US2] Add `tone?: string` to `GroundedExtractionConfig` in `src/generators/GroundedExtractor.ts`, documented the same way as its existing `identity`/`rules` fields — no other code change needed, since `super(config)` already passes `tone` through to `GroundedCall`'s constructor (depends on T004, T008)

**Checkpoint**: All user stories are independently functional — `tone` is available and behaves consistently across all three components.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and end-to-end validation, after both user stories are complete.

- [X] T011 [P] Update `README.md` (both Português and English sections): document `tone` alongside `identity`/`rules` in the shared "Generators" overview (three optional personalization parameters instead of two), noting the composition order `identity` → `rules` → `tone` (depends on T010)
- [X] T012 Run all 5 `quickstart.md` validation scenarios end-to-end against the implementation — all 5 covered by the new test suite (Cenário 1→T005; 2→pre-existing identity/rules-omitted tests; 3→T002c; 4→T005+T007+T008; 5→T002b)
- [X] T013 Build verification: `npm run build` succeeds and `npm test` passes fully (all features 001+002+003+004 tests) — 85/85 passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — establishes the regression baseline.
- **Foundational (Phase 2)**: Depends on Phase 1. BLOCKS all user stories — both stories rely on `GroundedCall.buildSystemPrompt` composing `tone` correctly.
- **User Story 1 (Phase 3)**: Depends on Foundational. Touches only `GroundedGenerator.ts`'s test file (no production code change) — independent of US2 (different files).
- **User Story 2 (Phase 4)**: Depends on Foundational. Touches `GroundedEnricher.ts`'s test file (no production code change) and `GroundedExtractor.ts` (one type-only change) — independent of US1 (different files).
- **Polish (Phase 5)**: Depends on US1 and US2 both being complete.

### User Story Dependencies

- **US1 (P1)**: Independent of US2 — touches only `src/generators/GroundedGenerator.ts`'s test file.
- **US2 (P2)**: Independent of US1 — touches `src/generators/GroundedEnricher.ts`'s test file and `src/generators/GroundedExtractor.ts`.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Foundational (`tone` in `GroundedCallConfig` + `buildSystemPrompt`) before any per-component verification.

### Parallel Opportunities

- Once Foundational (Phase 2) is done, US1 (T005-T006) and US2 (T007-T010) can be implemented fully in parallel by different developers (disjoint files).
- T007 and T008 (US2 tests, different files) can be written in parallel.

---

## Parallel Example: User Story 1 and User Story 2

```bash
# Once Foundational (Phase 2) is done, launch both independent stories together:
Task: "US1 — GroundedGenerator tone verification (T005-T006)"
Task: "US2 — GroundedEnricher + GroundedExtractor tone consistency (T007-T010)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (`GroundedGenerator` reflects `tone`).
4. **STOP and VALIDATE**: run T005 independently; this alone delivers the chatbot-tone scenario that motivated the feature.

### Incremental Delivery

1. Setup + Foundational → `tone` composed correctly by the shared base.
2. Add US1 (`GroundedGenerator`) → validate independently → ship.
3. Add US2 (`GroundedEnricher` + `GroundedExtractor` consistency) → validate independently → ship.
4. Polish (README, quickstart, build).

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: US1 (`GroundedGenerator`)
- Developer B: US2 (`GroundedEnricher` + `GroundedExtractor`)

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- No new default value is introduced — `tone` is purely additive and optional, mirroring `identity`/`rules` exactly (see research.md).

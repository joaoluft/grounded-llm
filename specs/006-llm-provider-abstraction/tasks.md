# Tasks: Multi-provider LLM Abstraction

**Input**: Design documents from `specs/006-llm-provider-abstraction/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (required), [research.md](research.md), [data-model.md](data-model.md), [contracts/llm-provider.md](contracts/llm-provider.md), [contracts/library-api.md](contracts/library-api.md)

**Tests**: Includes provider contract test suite and provider-specific unit/integration tests as required by spec FR-008 and FR-009.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Include exact file paths in descriptions

## Path Conventions

- Single TypeScript library: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and SDK dependency setup

- [X] T001 Add `@anthropic-ai/sdk` and `@google/genai` to dependencies in `package.json`
- [X] T002 [P] Create providers module directory structure and setup module barrel exports in `src/providers/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core provider contract interfaces, registry, selection config, and error taxonomy

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Define core provider contract interfaces (`LLMProviderContract`, `ProviderRequest`, `ProviderResponse`, `ProviderCapabilityProfile`) in `src/providers/types.ts`
- [X] T004 [P] Extend error taxonomy with `ProviderError` categories (selection, auth, unavailable, output-invalid, unsupported-capability) and remediation hint fields in `src/core/errors.ts`
- [X] T005 [P] Implement `ProviderSelectionConfig` resolution and precedence logic (parameter > env > default) in `src/providers/config.ts`
- [X] T006 Implement `ProviderRegistry` for registering and retrieving provider adapters by `providerId` in `src/providers/registry.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Keep Existing Integrations Working (Priority: P1) 🎯 MVP

**Goal**: Refactor current OpenAI call path into an OpenAI adapter (`src/providers/openai.ts`) implementing `LLMProviderContract`, maintaining OpenAI as default provider behavior without breaking existing entry points or tests.

**Independent Test**: Run existing unit and contract test suites (`npm test`) and verify 100% backward compatibility for all default generator calls.

### Tests for User Story 1

- [X] T007 [P] [US1] Add backward compatibility unit tests verifying default provider selection and response shape in `tests/unit/core/grounded-call.test.ts`

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `OpenAIProviderAdapter` fulfilling `LLMProviderContract` for `completeStructured` in `src/providers/openai.ts`
- [X] T009 [US1] Register OpenAI provider as default in `src/providers/registry.ts` and export from `src/providers/index.ts`
- [X] T010 [US1] Refactor `groundedCall` execution loop in `src/core/grounded-call.ts` to dispatch calls via `ProviderRegistry` while preserving public options interface
- [X] T011 [P] [US1] Export provider configuration options and updated core types from `src/index.ts`
- [X] T012 [US1] Run baseline regression test suite (`npm test`) to verify all existing tests pass unchanged

**Checkpoint**: At this point, User Story 1 should be fully functional with 100% backward compatibility for existing users.

---

## Phase 4: User Story 2 - Select a Different Provider (Priority: P2)

**Goal**: Implement Anthropic and Google provider adapters, support explicit runtime parameter and environment-variable provider selection, and surface actionable misconfiguration errors.

**Independent Test**: Configure Anthropic or Google provider via runtime options or environment variables, execute grounded requests, and verify responses; verify fast-fail behavior with remediation hints on invalid/missing config.

### Tests for User Story 2

- [X] T013 [P] [US2] Add unit tests for provider selection precedence (parameter > env > default) in `tests/unit/providers/config.test.ts`
- [X] T014 [P] [US2] Add unit tests for provider misconfiguration and credential error handling in `tests/unit/providers/errors.test.ts`
- [X] T015 [P] [US2] Add integration tests for Anthropic provider adapter in `tests/unit/providers/anthropic.test.ts`
- [X] T016 [P] [US2] Add integration tests for Google provider adapter in `tests/unit/providers/google.test.ts`

### Implementation for User Story 2

- [X] T017 [P] [US2] Implement `AnthropicProviderAdapter` fulfilling `LLMProviderContract` in `src/providers/anthropic.ts`
- [X] T018 [P] [US2] Implement `GoogleProviderAdapter` fulfilling `LLMProviderContract` in `src/providers/google.ts`
- [X] T019 [US2] Register Anthropic and Google adapters in `src/providers/registry.ts` and expose in `src/providers/index.ts`
- [X] T020 [US2] Connect provider selection options to `GroundedGenerator`, `GroundedExtractor`, and `GroundedEnricher` options in `src/generators/grounded-generator.ts`, `src/generators/grounded-extractor.ts`, and `src/generators/grounded-enricher.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 are functional. Users can select OpenAI, Anthropic, or Google seamlessly.

---

## Phase 5: User Story 3 - Add New Providers Consistently (Priority: P3)

**Goal**: Establish a provider-agnostic contract test suite validating all provider implementations against required capabilities and error semantics, and document the extension workflow.

**Independent Test**: Execute provider contract test suite against OpenAI, Anthropic, and Google adapters, confirming compliance and clear failure on incomplete contract implementations.

### Tests for User Story 3

- [X] T021 [P] [US3] Create shared provider contract test suite validating `completeStructured`, capability profiles, and error semantics in `tests/contract/providers/llm-provider.contract.test.ts`

### Implementation for User Story 3

- [X] T022 [US3] Add contract test runner helper for third-party adapter validation in `tests/contract/providers/contract-runner.ts`
- [X] T023 [US3] Run shared contract test suite (`npx vitest run tests/contract/providers/`) against OpenAI, Anthropic, and Google adapters

**Checkpoint**: All user stories are independently functional and validated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, quality checks, and end-to-end quickstart validation

- [X] T024 [P] Update `README.md` with multi-provider usage instructions, environment variable setup, supported provider list, and extension guide for new adapters
- [X] T025 Run full quality suite (`npm run quality`) including linting, formatting, type checking, and tests
- [X] T026 Validate end-to-end scenarios described in `specs/006-llm-provider-abstraction/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) → User Story 2 (P2) → User Story 3 (P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on provider registry from US1 infrastructure
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Validates adapters produced in US1 and US2

### Parallel Opportunities

- All Setup tasks marked `[P]` can run in parallel (T002)
- All Foundational tasks marked `[P]` can run in parallel (T003, T004, T005)
- In US1: T007 (unit test), T008 (OpenAI adapter), T011 (export types) can run in parallel
- In US2: T013, T014, T015, T016 (tests), T017 (Anthropic adapter), T018 (Google adapter) can run in parallel
- In US3: T021 (contract test suite) can run in parallel with US2 completion

---

## Parallel Example: User Story 2

```bash
# Launch parallel tests for User Story 2:
Task: "Add unit tests for provider selection precedence in tests/unit/providers/config.test.ts"
Task: "Add unit tests for provider misconfiguration in tests/unit/providers/errors.test.ts"
Task: "Add integration tests for Anthropic provider adapter in tests/unit/providers/anthropic.test.ts"
Task: "Add integration tests for Google provider adapter in tests/unit/providers/google.test.ts"

# Launch parallel provider adapters for User Story 2:
Task: "Implement AnthropicProviderAdapter in src/providers/anthropic.ts"
Task: "Implement GoogleProviderAdapter in src/providers/google.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify baseline OpenAI tests pass with zero regressions
5. Ready for MVP release

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Baseline pass → MVP!
3. Add User Story 2 → Anthropic + Google support → Multi-provider release
4. Add User Story 3 → Contract tests + contributor guide → Extensible ecosystem

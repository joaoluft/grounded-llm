---
description: "Task list for Files Kebab-Case Rename feature"
---

# Tasks: Files Kebab-Case Rename

**Input**: Design documents from `/specs/005-files-kebab-case-rename/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/library-api.md, quickstart.md

**Tests**: Not requested in feature specification. Focus on implementation and validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4])
- Include exact file paths in descriptions

## Path Conventions

- Repository root: `grounded-llm/`
- Source files: `src/core/`, `src/generators/`, `src/index.ts`
- Test files: `tests/contract/generators/`, `tests/unit/core/`, `tests/unit/generators/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [ ] T001 Verify file structure and create comprehensive rename checklist documenting all 22 files requiring name changes
- [ ] T002 Verify git status and create backup branch if needed (already on `005-files-kebab-case-rename`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking prerequisites for this refactoring - all source and test files can be processed in parallel phases

**✅ GATE PASSED**: No foundational work needed - proceed directly to user story phases

---

## Phase 3: User Story 1 - Rename All Source Files to Kebab-Case (Priority: P1) 🎯 MVP

**Goal**: Rename all 7 PascalCase source files in `src/` to kebab-case format while preserving functionality

**Independent Test**: All source files in `src/` have kebab-case names; no file references PascalCase

### Implementation for User Story 1

- [ ] T003 [P] [US1] Rename `src/core/contextWindow.ts` to `src/core/context-window.ts`
- [ ] T004 [P] [US1] Rename `src/core/GroundedCall.ts` to `src/core/grounded-call.ts`
- [ ] T005 [P] [US1] Rename `src/generators/GroundedGenerator.ts` to `src/generators/grounded-generator.ts`
- [ ] T006 [P] [US1] Rename `src/generators/GroundedEnricher.ts` to `src/generators/grounded-enricher.ts`
- [ ] T007 [P] [US1] Rename `src/generators/GroundedExtractor.ts` to `src/generators/grounded-extractor.ts`
- [ ] T008 [P] [US1] Rename `src/generators/GroundedEnricher.schema.ts` to `src/generators/grounded-enricher.schema.ts`
- [ ] T009 [P] [US1] Rename `src/generators/GroundedExtractor.schema.ts` to `src/generators/grounded-extractor.schema.ts`

**Checkpoint**: All source files renamed; US1 independent test passes

---

## Phase 4: User Story 2 - Update All Import Statements (Priority: P1)

**Goal**: Update all TypeScript import statements to reference new kebab-case file paths; ensure zero compilation errors

**Independent Test**: TypeScript compiler produces zero import/module resolution errors; all tests compile successfully

### Implementation for User Story 2

- [ ] T010 [US2] Update all import statements in `src/index.ts` to reference kebab-case file paths (e.g., `from './core/grounded-call'`)
- [ ] T011 [US2] Update all relative imports in `src/core/*.ts` files to use kebab-case paths (e.g., `from './context-window'`)
- [ ] T012 [US2] Update all relative imports in `src/generators/*.ts` files to use kebab-case paths (e.g., `from './grounded-generator'`)
- [ ] T013 [US2] Update all import statements in `tests/contract/generators/*.ts` files to reference kebab-case source files
- [ ] T014 [US2] Update all import statements in `tests/unit/core/*.ts` files to reference kebab-case source files
- [ ] T015 [US2] Update all import statements in `tests/unit/generators/*.ts` files to reference kebab-case source files
- [ ] T016 [US2] Run TypeScript compiler (`npm run build`) and verify zero errors for import resolution
- [ ] T017 [US2] Verify all imports resolve correctly by checking build output in `dist/` directory

**Checkpoint**: All imports updated; US2 independent test passes; TypeScript compilation succeeds

---

## Phase 5: User Story 3 - Update Test Files to Kebab-Case (Priority: P2)

**Goal**: Rename all 15 test files to kebab-case format for consistency with source files

**Independent Test**: All test files in `tests/` use kebab-case naming; 100% test pass rate maintained

### Implementation for User Story 3

- [ ] T018 [P] [US3] Rename `tests/contract/generators/GroundedEnricher.schema.test.ts` to `tests/contract/generators/grounded-enricher.schema.test.ts`
- [ ] T019 [P] [US3] Rename `tests/contract/generators/GroundedExtractor.schema.test.ts` to `tests/contract/generators/grounded-extractor.schema.test.ts`
- [ ] T020 [P] [US3] Rename `tests/contract/generators/GroundedGenerator.schema.test.ts` to `tests/contract/generators/grounded-generator.schema.test.ts`
- [ ] T021 [P] [US3] Rename `tests/unit/core/GroundedCall.test.ts` to `tests/unit/core/grounded-call.test.ts`
- [ ] T022 [P] [US3] Rename `tests/unit/generators/GroundedEnricher.test.ts` to `tests/unit/generators/grounded-enricher.test.ts`
- [ ] T023 [P] [US3] Rename `tests/unit/generators/GroundedEnricher.fallbackRate.evaluation.test.ts` to `tests/unit/generators/grounded-enricher.fallback-rate.evaluation.test.ts`
- [ ] T024 [P] [US3] Rename `tests/unit/generators/GroundedEnricher.traceability.evaluation.test.ts` to `tests/unit/generators/grounded-enricher.traceability.evaluation.test.ts`
- [ ] T025 [P] [US3] Rename `tests/unit/generators/GroundedExtractor.test.ts` to `tests/unit/generators/grounded-extractor.test.ts`
- [ ] T026 [P] [US3] Rename `tests/unit/generators/GroundedExtractor.fallbackRate.evaluation.test.ts` to `tests/unit/generators/grounded-extractor.fallback-rate.evaluation.test.ts`
- [ ] T027 [P] [US3] Rename `tests/unit/generators/GroundedExtractor.strictMode.evaluation.test.ts` to `tests/unit/generators/grounded-extractor.strict-mode.evaluation.test.ts`
- [ ] T028 [P] [US3] Rename `tests/unit/generators/GroundedExtractor.traceability.evaluation.test.ts` to `tests/unit/generators/grounded-extractor.traceability.evaluation.test.ts`
- [ ] T029 [P] [US3] Rename `tests/unit/generators/GroundedGenerator.test.ts` to `tests/unit/generators/grounded-generator.test.ts`
- [ ] T030 [P] [US3] Rename `tests/unit/generators/GroundedGenerator.fallbackRate.evaluation.test.ts` to `tests/unit/generators/grounded-generator.fallback-rate.evaluation.test.ts`
- [ ] T031 [P] [US3] Rename `tests/unit/generators/GroundedGenerator.integration.test.ts` to `tests/unit/generators/grounded-generator.integration.test.ts`
- [ ] T032 [P] [US3] Rename `tests/unit/generators/GroundedGenerator.traceability.evaluation.test.ts` to `tests/unit/generators/grounded-generator.traceability.evaluation.test.ts`

**Checkpoint**: All test files renamed; US3 independent test passes

---

## Phase 6: User Story 4 - Verify No Breaking Changes to Package API (Priority: P1)

**Goal**: Confirm public API surface remains unchanged and all tests pass; validate non-breaking nature of refactoring

**Independent Test**: Public API exports are identical; build succeeds; all tests pass; type definitions are correct

### Implementation for User Story 4

- [ ] T033 [US4] Run full test suite (`npm test`) and verify all unit, contract, and evaluation tests pass with no failures
- [ ] T034 [US4] Verify that `src/index.ts` exports unchanged class names: `GroundedGenerator`, `GroundedExtractor`, `GroundedEnricher`, `GroundedCall`, `ContextWindow`
- [ ] T035 [US4] Verify generated `.d.ts` type definition files in `dist/` are valid and match expected public API surface
- [ ] T036 [US4] Verify package builds successfully (`npm run build`) with correct main and types entries in `package.json`

**Checkpoint**: All tests pass; public API verified; US4 independent test passes; feature is non-breaking

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T037 Execute full validation from `specs/005-files-kebab-case-rename/quickstart.md` (all 5 validation scenarios must pass)
- [ ] T038 [P] Verify no file names in `src/` or `tests/` contain uppercase letters (find command pattern check)
- [ ] T039 [P] Verify build artifacts are valid and ready for distribution in `dist/` directory
- [ ] T040 Update feature status in `specs/005-files-kebab-case-rename/spec.md` to "Complete"

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) [SKIPPED - no blocking work needed]
    ↓
Phase 3 (US1: Rename Source Files) ← Can run immediately after Setup
    ├─→ Phase 4 (US2: Update Imports) ← DEPENDS ON Phase 3
    │   ├─→ Phase 6 (US4: Verify API) ← DEPENDS ON Phase 4 AND Phase 5
    │
    └─→ Phase 5 (US3: Rename Test Files) ← Can run parallel with Phase 4
        └─→ Phase 6 (US4: Verify API) ← DEPENDS ON Phase 4 AND Phase 5
            ↓
Phase 7 (Polish) ← DEPENDS ON Phase 6
```

### User Story Execution Constraints

- **US1 (Rename Source Files)**: No dependencies - can start immediately
  - MUST complete before US2
  - Can run parallel with US3 (different files)

- **US2 (Update Imports)**: DEPENDS ON US1 - can start after US1 completes
  - MUST complete before US4

- **US3 (Rename Test Files)**: No dependencies - can run parallel with US1/US2
  - MUST complete before US4

- **US4 (Verify API)**: DEPENDS ON US2 AND US3 - can only start after both complete
  - This is the final validation phase

### Critical Path

1. **Phase 1** (Setup) → Complete immediately
2. **Phase 3** (US1: Rename Source Files) → 7 files, can all be parallel
3. **Phase 4** (US2: Update Imports) → After Phase 3, sequential steps
4. **Phase 5** (US3: Rename Test Files) → Can run parallel with Phase 4
5. **Phase 6** (US4: Verify API) → After Phase 4 AND Phase 5 complete
6. **Phase 7** (Polish) → Final validation

### Parallel Opportunities

**Parallel Group 1** (Phase 3 - US1):
- All 7 file renames can execute in parallel on different machines/terminals
- No dependencies between renames
- Example: `(T003 + T004 + T005 + T006 + T007 + T008 + T009) in parallel`

**Parallel Group 2** (Phase 5 - US3):
- All 15 test file renames can execute in parallel
- No dependencies between renames
- Example: `(T018 + T019 + T020 + ... + T032) in parallel`

**Sequential Constraint** (Phase 4 - US2):
- T010 (Update src/index.ts) - single file, no parallelization
- T011 (Update src/core imports) - single batch
- T012 (Update src/generators imports) - single batch
- T013-T015 (Update test imports) - can group but recommend sequential for safety
- T016-T017 (Verify compilation) - must be sequential

**Optimal Execution Timeline**:
- Day 1: Phase 1 (Setup) + Phase 3 (US1, parallel)
- Day 2: Phase 4 (US2, sequential) + Phase 5 (US3, parallel with Phase 4)
- Day 3: Phase 6 (US4) + Phase 7 (Polish)

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

Complete all user stories to achieve the feature goal:

- ✅ US1: All source files renamed
- ✅ US2: All imports updated and compiling
- ✅ US3: All test files renamed and passing
- ✅ US4: Public API verified, no breaking changes

This is a unified refactoring where all user stories must be completed together to deliver value.

### Incremental Delivery Phases

1. **Phase 1-3 (Days 1-2)**: File renaming (renames can be batched)
   - Deliverable: All files renamed to kebab-case

2. **Phase 4-5 (Day 2-3)**: Import updates and test renaming
   - Deliverable: Compilation successful, tests discover renamed files

3. **Phase 6-7 (Day 3)**: Validation and finalization
   - Deliverable: Feature complete, ready for merge

### Validation Checkpoints

- **After Phase 3**: Verify file names only (no compilation yet)
- **After Phase 4**: `npm run build` must succeed with zero errors
- **After Phase 5**: All tests pass with zero failures
- **After Phase 6**: Public API unchanged, type definitions correct
- **After Phase 7**: Full quickstart.md validation passes

---

## Task Statistics

| Metric | Value |
|--------|-------|
| **Total Tasks** | 40 |
| **Setup Tasks** | 2 |
| **Foundational Tasks** | 0 |
| **US1 Tasks (Source Renaming)** | 7 |
| **US2 Tasks (Import Updates)** | 8 |
| **US3 Tasks (Test Renaming)** | 15 |
| **US4 Tasks (Verification)** | 4 |
| **Polish Tasks** | 4 |
| **Parallelizable Tasks** | 26 (US1: 7 + US3: 15 + Polish: 4) |
| **Sequential Tasks** | 14 (Setup: 2 + US2: 8 + US4: 4) |

---

## Success Criteria

✅ All 40 tasks completed
✅ All source files renamed to kebab-case
✅ All test files renamed to kebab-case
✅ All imports updated and compiling
✅ All tests passing (unit, contract, evaluation)
✅ TypeScript compilation produces zero errors
✅ Public API unchanged (same exports, same names)
✅ Generated type definitions (.d.ts) valid and correct
✅ Quickstart validation passes
✅ Build artifacts in `dist/` are valid

---

## Notes

- This refactoring is purely mechanical (file name changes and import updates)
- No logic changes or functionality modifications
- Zero risk of breaking external consumers (public API unchanged)
- All tests should pass identically before and after refactoring
- Estimated timeline: 3 days with parallel execution opportunities
- Can be reviewed and merged as single PR with clear scope

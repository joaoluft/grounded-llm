# Data Model: Files Kebab-Case Rename

**Feature**: Files Kebab-Case Rename | **Date**: 2026-07-16

## Entities Affected by This Feature

### 1. Source File Entities

**Core Files** (`src/core/`)

- `context-window.ts` ← `contextWindow.ts`
- `errors.ts` (unchanged)
- `grounded-call.ts` ← `GroundedCall.ts`
- `types.ts` (unchanged)

**Generator Files** (`src/generators/`)

- `grounded-enricher.ts` ← `GroundedEnricher.ts`
- `grounded-enricher.schema.ts` ← `GroundedEnricher.schema.ts`
- `grounded-extractor.ts` ← `GroundedExtractor.ts`
- `grounded-extractor.schema.ts` ← `GroundedExtractor.schema.ts`
- `grounded-generator.ts` ← `GroundedGenerator.ts`
- `schema.ts` (unchanged)

**Root Files** (`src/`)

- `index.ts` (exports updated, but file name unchanged)

### 2. Test File Entities

**Contract Tests** (`tests/contract/generators/`)

- `grounded-enricher.schema.test.ts` ← `GroundedEnricher.schema.test.ts`
- `grounded-extractor.schema.test.ts` ← `GroundedExtractor.schema.test.ts`
- `grounded-generator.schema.test.ts` ← `GroundedGenerator.schema.test.ts`

**Unit Tests** (`tests/unit/`)

- `grounded-call.test.ts` ← `GroundedCall.test.ts`
- `grounded-enricher.test.ts` ← `GroundedEnricher.test.ts`
- `grounded-enricher.fallback-rate.evaluation.test.ts` ← `GroundedEnricher.fallbackRate.evaluation.test.ts`
- `grounded-enricher.traceability.evaluation.test.ts` ← `GroundedEnricher.traceability.evaluation.test.ts`
- `grounded-extractor.test.ts` ← `GroundedExtractor.test.ts`
- `grounded-extractor.fallback-rate.evaluation.test.ts` ← `GroundedExtractor.fallbackRate.evaluation.test.ts`
- `grounded-extractor.strict-mode.evaluation.test.ts` ← `GroundedExtractor.strictMode.evaluation.test.ts`
- `grounded-extractor.traceability.evaluation.test.ts` ← `GroundedExtractor.traceability.evaluation.test.ts`
- `grounded-generator.test.ts` ← `GroundedGenerator.test.ts`
- `grounded-generator.fallback-rate.evaluation.test.ts` ← `GroundedGenerator.fallbackRate.evaluation.test.ts`
- `grounded-generator.integration.test.ts` ← `GroundedGenerator.integration.test.ts`
- `grounded-generator.traceability.evaluation.test.ts` ← `GroundedGenerator.traceability.evaluation.test.ts`

### 3. Import Statement Entities

**Types**:

- File path imports: `from './GroundedCall'` → `from './grounded-call'`
- Index imports: `from '../generators'` (unchanged, but internal paths change)
- Relative imports: All relative paths updated to use kebab-case file names

**Validation Rules**:

- No empty import paths
- All relative imports (./ or ../) must resolve to existing kebab-case files
- Absolute imports from package name unchanged (e.g., `from 'grounded-llm'`)

### 4. Public API Entities

**Export Points** (`src/index.ts`)

- `GroundedGenerator` (class name unchanged, source file renamed)
- `GroundedExtractor` (class name unchanged, source file renamed)
- `GroundedEnricher` (class name unchanged, source file renamed)
- `GroundedCall` (class name unchanged, source file renamed)
- `ContextWindow` (class name unchanged, source file renamed)
- Type exports (unchanged)

**Invariants**:

- All public API names must remain identical
- Export statements must reference kebab-case file paths
- Type definitions must be correct and match expected surface

## State Transitions

### Refactoring State Machine

```
[Initial State]
  ↓ (rename source files)
[Source Files Renamed]
  ↓ (update imports in src/)
[Src Imports Updated]
  ↓ (rename test files)
[Test Files Renamed]
  ↓ (update imports in tests/)
[Test Imports Updated]
  ↓ (verify compilation)
[TypeScript Compiles]
  ↓ (run all tests)
[All Tests Pass] ← [Final State: Success]
  ↓ (if any step fails)
[Error State] → [Rollback Required]
```

## Validation Rules

- **File Name Validation**: All `.ts` files in `src/` and `tests/` must match pattern `^[a-z]([a-z0-9-]*[a-z0-9])?(\.[a-z]+)*\.ts$`
- **Import Validation**: All import statements must reference valid kebab-case files
- **Compilation Validation**: `tsc --noEmit` must produce zero errors
- **Test Validation**: All test suites must pass with 100% test pass rate
- **API Validation**: Public API exports must match pre-refactoring surface

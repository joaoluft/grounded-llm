# Rename Checklist: Files Kebab-Case Refactoring

**Status**: In Progress
**Date Started**: 2026-07-16
**Task**: T001 - Setup & Verification

## Current File Structure (PascalCase)

### Source Files to Rename (7 files)

#### src/core/
- [ ] contextWindow.ts → context-window.ts
- [ ] GroundedCall.ts → grounded-call.ts

#### src/generators/
- [ ] GroundedGenerator.ts → grounded-generator.ts
- [ ] GroundedEnricher.ts → grounded-enricher.ts
- [ ] GroundedExtractor.ts → grounded-extractor.ts
- [ ] GroundedEnricher.schema.ts → grounded-enricher.schema.ts
- [ ] GroundedExtractor.schema.ts → grounded-extractor.schema.ts

**Subtotal**: 7 source files

### Test Files to Rename (15 files)

#### tests/contract/generators/
- [ ] GroundedEnricher.schema.test.ts → grounded-enricher.schema.test.ts
- [ ] GroundedExtractor.schema.test.ts → grounded-extractor.schema.test.ts
- [ ] GroundedGenerator.schema.test.ts → grounded-generator.schema.test.ts

#### tests/unit/core/
- [ ] GroundedCall.test.ts → grounded-call.test.ts

#### tests/unit/generators/
- [ ] GroundedEnricher.test.ts → grounded-enricher.test.ts
- [ ] GroundedEnricher.fallbackRate.evaluation.test.ts → grounded-enricher.fallback-rate.evaluation.test.ts
- [ ] GroundedEnricher.traceability.evaluation.test.ts → grounded-enricher.traceability.evaluation.test.ts
- [ ] GroundedExtractor.test.ts → grounded-extractor.test.ts
- [ ] GroundedExtractor.fallbackRate.evaluation.test.ts → grounded-extractor.fallback-rate.evaluation.test.ts
- [ ] GroundedExtractor.strictMode.evaluation.test.ts → grounded-extractor.strict-mode.evaluation.test.ts
- [ ] GroundedExtractor.traceability.evaluation.test.ts → grounded-extractor.traceability.evaluation.test.ts
- [ ] GroundedGenerator.test.ts → grounded-generator.test.ts
- [ ] GroundedGenerator.fallbackRate.evaluation.test.ts → grounded-generator.fallback-rate.evaluation.test.ts
- [ ] GroundedGenerator.integration.test.ts → grounded-generator.integration.test.ts
- [ ] GroundedGenerator.traceability.evaluation.test.ts → grounded-generator.traceability.evaluation.test.ts

**Subtotal**: 15 test files

### Total: 22 files to rename

## Files NOT to be Renamed

- src/core/errors.ts (already lowercase)
- src/core/types.ts (already lowercase)
- src/generators/schema.ts (already lowercase)
- src/index.ts (no PascalCase prefix)

## Import Update Locations

### Source Files That Import Other Source Files
- [ ] src/index.ts (imports from generators and core)
- [ ] src/core/ files (internal core imports)
- [ ] src/generators/ files (internal generator imports)

### Test Files That Import Source Files
- [ ] tests/contract/generators/ (all contract tests)
- [ ] tests/unit/core/ (all core unit tests)
- [ ] tests/unit/generators/ (all generator unit tests)

**Total Import Update Locations**: 12 files

## Validation Checkpoints

- [ ] **Pre-Rename**: No compilation errors (baseline)
- [ ] **After Source Rename**: All 7 source files renamed
- [ ] **After Test Rename**: All 15 test files renamed
- [ ] **After Import Updates**: TypeScript compilation succeeds
- [ ] **Test Verification**: All tests pass (unit, contract, evaluation)
- [ ] **API Verification**: Public exports unchanged
- [ ] **Build Verification**: npm run build succeeds

## Notes

- All renames follow pattern: PascalCase → kebab-case
- camelCase with capital first letter becomes lowercase with hyphens
- Evaluation test files use pattern: name.evaluation.test.ts → name-evaluation.test.ts (NO "name.evaluation")
- Schema files: ClassName.schema.ts → class-name.schema.ts
- File extensions remain unchanged (.ts, .test.ts)

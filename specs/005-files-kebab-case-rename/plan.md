# Implementation Plan: Files Kebab-Case Rename

**Branch**: `005-files-kebab-case-rename` | **Date**: 2026-07-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-files-kebab-case-rename/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Refactor the entire codebase to follow JavaScript/TypeScript standard naming conventions by renaming all source files and test files from PascalCase to kebab-case (e.g., `GroundedCall.ts` → `grounded-call.ts`). Update all import statements to reflect the new file paths while maintaining the public API and ensuring all tests pass. This is foundational infrastructure work that aligns the project with community standards and improves developer experience.

## Technical Context

**Language/Version**: TypeScript 5.x (tsconfig.json configured)

**Primary Dependencies**: vitest (testing), tsup (bundling), Node.js 18+

**Storage**: N/A (library, no persistent storage)

**Testing**: vitest (configured in vitest.config.ts)

**Target Platform**: Node.js / npm packages (JavaScript/TypeScript ecosystem)

**Project Type**: TypeScript library (grounded-llm)

**Performance Goals**: No impact on runtime performance (refactoring only)

**Constraints**: Zero breaking changes to public API (external consumers must not be affected)

**Scale/Scope**: 26 source files, 22 test files requiring renaming; all import paths must be updated

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The constitution template is not yet populated. However, this feature poses no governance concerns:

- No new services or components are introduced
- Public API remains unchanged (pure refactoring)
- Testing requirements are maintained (no degradation)
- Build process remains the same
- No breaking changes for consumers

✅ **GATE PASSED**: Feature aligns with standard software practices and poses no violations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── context-window.ts          (from contextWindow.ts)
│   ├── errors.ts
│   ├── grounded-call.ts           (from GroundedCall.ts)
│   └── types.ts
├── generators/
│   ├── grounded-enricher.ts       (from GroundedEnricher.ts)
│   ├── grounded-enricher.schema.ts (from GroundedEnricher.schema.ts)
│   ├── grounded-extractor.ts      (from GroundedExtractor.ts)
│   ├── grounded-extractor.schema.ts (from GroundedExtractor.schema.ts)
│   ├── grounded-generator.ts      (from GroundedGenerator.ts)
│   └── schema.ts
└── index.ts

tests/
├── contract/
│   └── generators/
│       ├── grounded-enricher.schema.test.ts
│       ├── grounded-extractor.schema.test.ts
│       └── grounded-generator.schema.test.ts
└── unit/
    ├── core/
    │   └── grounded-call.test.ts
    └── generators/
        ├── grounded-enricher.fallback-rate.evaluation.test.ts
        ├── grounded-enricher.test.ts
        ├── grounded-enricher.traceability.evaluation.test.ts
        ├── grounded-extractor.fallback-rate.evaluation.test.ts
        ├── grounded-extractor.strict-mode.evaluation.test.ts
        ├── grounded-extractor.test.ts
        ├── grounded-extractor.traceability.evaluation.test.ts
        ├── grounded-generator.fallback-rate.evaluation.test.ts
        ├── grounded-generator.integration.test.ts
        ├── grounded-generator.test.ts
        └── grounded-generator.traceability.evaluation.test.ts
```

**Structure Decision**: Single TypeScript library project following Node.js conventions. File renaming follows pattern: `PascalCase` → `kebab-case` for all source and test files. File extensions remain unchanged (.ts for source, .test.ts for tests). Directory structure remains identical.

## Design Artifacts Generated

### Phase 0: Research

✅ **research.md** — All design decisions documented:

- File naming convention rationale
- Scope and implementation approach
- Public API compatibility strategy
- Testing validation approach

### Phase 1: Design

✅ **data-model.md** — Complete mapping of all files and entities:

- 10 source files requiring renaming
- 13 test files requiring renaming
- Import statement patterns
- Public API entities that remain unchanged

✅ **contracts/library-api.md** — Public API contract:

- Export surface remains identical
- Build artifacts verification
- Backward compatibility guarantee

✅ **quickstart.md** — Validation scenarios:

- 5 runnable verification scenarios
- Pre/post refactoring validation checklist
- Rollback procedures if needed

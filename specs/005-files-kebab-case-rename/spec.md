# Feature Specification: Files Kebab-Case Rename

**Feature Branch**: `005-files-kebab-case-rename`

**Created**: 2026-07-16

**Status**: Draft

**Input**: Em uma nova branch, precisamos refatorar toda essa code base para seguir o padrão de nomenclatura de arquivos de apps javascript/typescript, que é o kebab-case. Hoje está no padrão PascalCase mas isso não é a conversão do Javascript/typescript.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rename All Source Files to Kebab-Case (Priority: P1)

Developers need to work with a codebase that follows standard JavaScript/TypeScript naming conventions. The current PascalCase file naming (e.g., `GroundedCall.ts`, `GroundedGenerator.ts`) conflicts with JavaScript community standards where kebab-case is the de facto convention for file names (e.g., `grounded-call.ts`, `grounded-generator.ts`).

**Why this priority**: This is fundamental infrastructure work that affects developer experience and aligns the entire codebase with community standards. All downstream development depends on this foundation.

**Independent Test**: Can be fully tested by verifying all source files in `src/` directory have kebab-case names while maintaining all import paths and functionality.

**Acceptance Scenarios**:

1. **Given** source files exist in `src/` directory with PascalCase names, **When** the refactoring is complete, **Then** all source files are renamed to kebab-case (e.g., `src/core/GroundedCall.ts` → `src/core/grounded-call.ts`)
2. **Given** import statements reference old PascalCase file names, **When** files are renamed, **Then** all import paths are updated to reference kebab-case file names
3. **Given** existing package exports in `src/index.ts`, **When** refactoring completes, **Then** exports reference correct kebab-case file paths and maintain API compatibility

---

### User Story 2 - Update All Import Statements (Priority: P1)

All TypeScript imports throughout the codebase must be updated to reflect the new kebab-case file paths to maintain compilation and runtime functionality.

**Why this priority**: Without updating imports, the code will not compile. This is blocking work that must be completed alongside file renaming.

**Independent Test**: Can be fully tested by running the TypeScript compiler and verifying no import errors exist. All tests should pass with updated imports.

**Acceptance Scenarios**:

1. **Given** imports in `src/` files reference old file names, **When** imports are updated, **Then** all paths use kebab-case file names
2. **Given** imports in `tests/` files reference source files, **When** imports are updated, **Then** test imports are corrected
3. **Given** the compiled codebase, **When** running any test, **Then** all imports resolve correctly with no module resolution errors

---

### User Story 3 - Update Test Files to Kebab-Case (Priority: P2)

Test files should follow the same naming convention for consistency. Test files (e.g., `GroundedCall.test.ts`) should also be renamed to kebab-case (e.g., `grounded-call.test.ts`).

**Why this priority**: Consistency across the entire codebase improves maintainability. While source file renaming is blocking, test file renaming can be executed in parallel and improves overall code organization.

**Independent Test**: Can be fully tested by verifying all test files follow the pattern `[kebab-case-name].test.ts` or `[kebab-case-name].evaluation.test.ts`.

**Acceptance Scenarios**:

1. **Given** test files in `tests/` with PascalCase names, **When** refactoring completes, **Then** all test files use kebab-case naming
2. **Given** evaluation test files, **When** renamed, **Then** pattern `[kebab-case-name].evaluation.test.ts` is followed
3. **Given** test files renamed, **When** test suite runs, **Then** all tests pass

---

### User Story 4 - Verify No Breaking Changes to Package API (Priority: P1)

The public API exported from the package (via `src/index.ts`) must remain unchanged so that external consumers of the library are not affected.

**Why this priority**: Breaking changes to public API would affect all users of the library. The refactoring should be purely internal (file names only) without changing what users import and use.

**Independent Test**: Can be fully tested by verifying that the exports in `package.json`'s main/types entries point to valid files and that generated type definitions are correct.

**Acceptance Scenarios**:

1. **Given** the current package exports classes like `GroundedGenerator`, `GroundedExtractor`, etc., **When** files are renamed, **Then** these exports are still available with the same names
2. **Given** external code imports from the package, **When** running against the renamed version, **Then** imports work without modification
3. **Given** generated `.d.ts` type definitions, **When** package is built, **Then** exports are correct and match what consumers expect

---

### Edge Cases

- What happens to dynamically constructed import paths (if any exist in the codebase)?
- How should monorepo workspace references be handled if they exist?
- Are there any generated files (e.g., from build process) that reference file names that need updating?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: All source files in `src/` MUST be renamed from PascalCase to kebab-case format (e.g., `GroundedCall.ts` → `grounded-call.ts`)
- **FR-002**: All import statements throughout the codebase (in `src/` and `tests/`) MUST be updated to reference the new kebab-case file paths
- **FR-003**: All test files in `tests/` MUST follow kebab-case naming convention
- **FR-004**: The TypeScript compiler MUST report zero import/module resolution errors after refactoring
- **FR-005**: All existing unit and contract tests MUST pass without modification to test logic
- **FR-006**: Generated type definitions and exports in `dist/` MUST be correct after build
- **FR-007**: The package exports in `src/index.ts` MUST maintain the same public API (class names, function names) as before

### Key Entities _(include if feature involves data)_

- **Source Files**: TypeScript files in `src/` directory that define the library's core functionality
- **Test Files**: Test files in `tests/` directory that validate functionality
- **Import Statements**: TypeScript `import` and `export` statements throughout the codebase
- **Package Exports**: Public API exports from `src/index.ts` that external consumers use

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of source files in `src/` are renamed to kebab-case format
- **SC-002**: 100% of test files in `tests/` are renamed to kebab-case format
- **SC-003**: TypeScript compiler produces zero errors related to module resolution or imports
- **SC-004**: All existing tests pass (unit tests, contract tests, and evaluation tests)
- **SC-005**: Package builds successfully with corrected import paths
- **SC-006**: Generated `.d.ts` type definition files are valid and exports are correct
- **SC-007**: Public API remains unchanged (same classes and functions exported with same names)

## Assumptions

- The codebase does not use dynamic imports with hardcoded file paths that would break with renaming
- No other tools or processes rely on specific file name patterns
- Build tools and test runners will automatically discover files with new names
- The project uses standard TypeScript and Node.js conventions (no custom file resolution logic)
- External package consumers only depend on the public API via `src/index.ts`, not on internal file names
- This is a non-breaking refactoring from a consumer perspective (public API stays the same)

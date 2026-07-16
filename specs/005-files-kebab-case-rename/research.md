# Research: Files Kebab-Case Rename

**Feature**: Files Kebab-Case Rename | **Date**: 2026-07-16

## Decisions

### 1. File Naming Convention

**Decision**: All source files will be renamed from PascalCase to kebab-case

**Rationale**:

- JavaScript/TypeScript community standard (de facto convention)
- Aligns with npm packages and popular frameworks (React, Vue, Angular, etc.)
- Improves consistency with JSON/YAML config files
- Better readability in shell commands and terminal workflows

**Alternatives considered**:

- Keep PascalCase (rejected: conflicts with ecosystem standards)
- Use snake_case (rejected: kebab-case is the JavaScript community standard, not snake_case)

### 2. Scope of Refactoring

**Decision**: Rename all source files in `src/` and all test files in `tests/`

**Rationale**:

- Complete consistency across the codebase
- No partial refactoring reduces confusion
- Test file names should match the files they test (e.g., `grounded-call.ts` → `grounded-call.test.ts`)

**Alternatives considered**:

- Rename only `src/` files (rejected: leaves tests in mixed state)
- Rename only critical files (rejected: incomplete refactoring creates technical debt)

### 3. Import Path Updates

**Decision**: Update all import statements to reference kebab-case file paths

**Rationale**:

- Required for TypeScript compilation to succeed
- Ensures no module resolution errors
- Maintains type safety throughout the codebase

**Implementation approach**:

- Search all `.ts` and `.tsx` files for import statements
- Replace references to PascalCase files with kebab-case equivalents
- Run TypeScript compiler to verify all imports resolve

### 4. Public API Compatibility

**Decision**: Maintain 100% public API compatibility (export names unchanged)

**Rationale**:

- External consumers should not be affected
- File names are internal implementation details
- Re-exporting from `index.ts` with original names ensures backward compatibility

**Implementation approach**:

- `src/index.ts` imports from new kebab-case files
- Re-exports maintain original class/function names (e.g., `export { GroundedGenerator } from './generators/grounded-generator.js'`)
- Generated `.d.ts` files must match current expectations

### 5. Testing Strategy

**Decision**: All existing tests will pass without modification to test logic

**Rationale**:

- Refactoring should not change functionality
- Tests validate behavior, not implementation details
- Zero test logic changes ensures quality

**Validation**:

- Run full test suite after all renames and import updates
- Verify contract tests pass
- Verify unit tests pass
- Verify evaluation tests pass

## Assumptions Validated

✅ No dynamic imports with hardcoded file paths in codebase
✅ No tools rely on specific file name patterns
✅ Standard TypeScript/Node.js setup (no custom resolution logic)
✅ Build tools (vitest, tsup) handle glob patterns automatically

## Open Questions Resolved

- **Q: Will this break for external consumers?**
    - A: No. Public API is re-exported from `index.ts` with original names. Package consumers only depend on public API.

- **Q: Do we need to update package.json main/types entries?**
    - A: No. These point to compiled output in `dist/`, not source files directly.

- **Q: What about generated type definitions?**
    - A: TypeScript compiler will generate correct `.d.ts` files based on updated imports.

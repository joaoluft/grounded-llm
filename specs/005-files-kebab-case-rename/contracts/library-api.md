# Public API Contract: Files Kebab-Case Rename

**Feature**: Files Kebab-Case Rename | **Date**: 2026-07-16

## Library API Surface (Unchanged)

This refactoring maintains complete backward compatibility with the public API. External consumers will experience zero breaking changes.

### Exported Classes

```typescript
// Main exports from 'grounded-llm' package remain identical
export { GroundedGenerator } from "./generators/grounded-generator";
export { GroundedExtractor } from "./generators/grounded-extractor";
export { GroundedEnricher } from "./generators/grounded-enricher";
export { GroundedCall } from "./core/grounded-call";
export { ContextWindow } from "./core/context-window";
```

**Contract**: All class names, methods, and signatures remain unchanged. Consumer code requires no modifications.

### Type Exports

All TypeScript type definitions and interfaces exported from the package remain available with the same names and signatures.

**Contract**: All types are correctly generated in `.d.ts` files with updated internal file paths.

## Build Artifact Contract

### Package Outputs

- `dist/index.js` — compiled JavaScript with same exports
- `dist/index.d.ts` — TypeScript declarations matching original API
- `package.json` — `main` and `types` entries point to same files

**Contract**: Build output is functionally identical to pre-refactoring state. No tooling changes required.

## Verification Points

**Before Refactoring**:

- Build succeeds: `npm run build`
- Tests pass: `npm test`
- All exports are available: consumers can import `{ GroundedGenerator, GroundedExtractor, ... }`

**After Refactoring**:

- Same builds succeed with same results
- Same tests pass with same results
- Same exports available with identical signatures
- Consumers can upgrade package without code changes

**Negative Test**: Attempts to import from internal file paths (e.g., `from 'grounded-llm/src/generators/grounded-generator'`) should still work via the public API export, or should fail identically to pre-refactoring behavior.

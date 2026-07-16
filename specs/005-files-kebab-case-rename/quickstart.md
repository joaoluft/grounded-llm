# Quickstart: Files Kebab-Case Rename Validation

**Feature**: Files Kebab-Case Rename | **Date**: 2026-07-16

## Objective

Validate that the files-kebab-case-rename feature is complete and working correctly. This guide demonstrates end-to-end validation of the refactoring using runnable steps.

## Prerequisites

- Node.js 18+ installed
- `npm install` completed in project root
- All changes committed or staged (for easy rollback if needed)

## Validation Scenarios

### Scenario 1: Verify All Files Are Renamed to Kebab-Case

**Objective**: Confirm no PascalCase file names remain in source and test directories

**Setup**: Terminal in project root

**Steps**:

```bash
# Check for PascalCase files in src/ (should return no results)
find src -type f -name '*[A-Z]*.ts' | grep -v node_modules

# Check for PascalCase files in tests/ (should return no results)
find tests -type f -name '*[A-Z]*.ts' | grep -v node_modules

# List all renamed files for visual verification
echo "=== Source Files ===" && find src -type f -name '*.ts' | sort
echo "=== Test Files ===" && find tests -type f -name '*.ts' | sort
```

**Expected Outcome**:

- No output from find commands (all files renamed)
- All files in output use kebab-case naming (lowercase with hyphens)
- File count matches pre-refactoring count

**Pass/Fail**: ✅ PASS if no PascalCase files exist

---

### Scenario 2: Verify TypeScript Compilation With No Errors

**Objective**: Confirm all import statements are correctly updated and TypeScript compiles

**Setup**: Terminal in project root

**Steps**:

```bash
# Verify TypeScript compilation with no errors
npm run build

# Check for import errors specifically
tsc --noEmit 2>&1 | grep -i "error\|cannot find"
```

**Expected Outcome**:

- `npm run build` completes successfully
- Zero TypeScript errors reported
- No "cannot find module" errors for any imports

**Pass/Fail**: ✅ PASS if both commands complete without errors

---

### Scenario 3: Verify All Tests Pass

**Objective**: Confirm functionality is preserved after refactoring

**Setup**: Terminal in project root

**Steps**:

```bash
# Run all tests
npm test

# Run specific test suites for verification
npm test -- tests/contract/
npm test -- tests/unit/
```

**Expected Outcome**:

- All tests pass (unit, contract, evaluation)
- No test failures or skipped tests
- Test output shows same number of passing tests as before refactoring

**Pass/Fail**: ✅ PASS if all tests pass without modification

---

### Scenario 4: Verify Public API Is Unchanged

**Objective**: Confirm external consumers are not affected

**Setup**: Terminal in project root

**Steps**:

```bash
# Build package
npm run build

# Verify exports are available
node -e "const pkg = require('./dist/index.js'); console.log('Exports:', Object.keys(pkg).sort().join(', '))"

# Compare to expected exports
# Should output: GroundedCall, GroundedEnricher, GroundedExtractor, GroundedGenerator, ContextWindow
```

**Expected Outcome**:

- All expected classes are exported: `GroundedGenerator`, `GroundedExtractor`, `GroundedEnricher`, `GroundedCall`, `ContextWindow`
- Export names are identical to pre-refactoring state
- Type definitions in `.d.ts` are valid

**Pass/Fail**: ✅ PASS if all exports are present and unchanged

---

### Scenario 5: Verify Build Artifacts Are Correct

**Objective**: Confirm generated files are valid for distribution

**Setup**: Terminal in project root

**Steps**:

```bash
# Check build output exists
ls -la dist/

# Verify main entry points
ls dist/index.js dist/index.d.ts

# Spot-check type definitions for a key class
grep "class GroundedGenerator" dist/index.d.ts || grep "GroundedGenerator" dist/index.d.ts
```

**Expected Outcome**:

- `dist/index.js` and `dist/index.d.ts` exist
- `.d.ts` file contains type definitions for all public classes
- No compilation warnings in build output

**Pass/Fail**: ✅ PASS if all artifacts are present and valid

---

## Verification Checklist

Use this checklist to confirm the refactoring is complete:

```
✅ All source files in src/ use kebab-case naming
✅ All test files in tests/ use kebab-case naming
✅ No PascalCase files exist in src/ or tests/
✅ TypeScript compilation succeeds with zero errors
✅ All imports resolve correctly (no "cannot find module" errors)
✅ All unit tests pass
✅ All contract tests pass
✅ All evaluation tests pass
✅ Public API exports are unchanged (same class names)
✅ Build artifacts (dist/) are generated correctly
✅ Type definitions (.d.ts) are valid and complete
```

## Next Steps

After validating all scenarios:

1. **Merge to main branch**: Submit PR for review
2. **Deploy package**: Publish updated version to npm
3. **Notify consumers**: If internal consumers exist, notify them that update is non-breaking

## Rollback Plan

If validation fails at any point:

```bash
# Restore from git
git checkout HEAD -- src/ tests/

# Or restore from stash if not yet committed
git stash pop
```

Then address issues and retry validation.

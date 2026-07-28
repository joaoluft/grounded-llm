# Quickstart: Validating Generator Error-Path Coverage & CI Summary

## Prerequisites

- Node.js >=20, `npm install` already run (see `CONTRIBUTING.md`).
- No real LLM provider API key needed — all tests mock the provider SDK.

## Validate User Story 1 (per-generator error-path tests)

Run just the generator test files touched by this feature:

```sh
npx vitest run tests/unit/generators/grounded-enricher.test.ts \
  tests/unit/generators/grounded-extractor.test.ts \
  tests/unit/generators/grounded-composer.test.ts \
  tests/unit/generators/grounded-generator.test.ts
```

**Expected outcome**: all pass, including new tests named along the lines of `reports
errorType 'model-unavailable' ...` / `... rejects.toBeInstanceOf(ModelUnavailableError)`
and `... rejects.toBeInstanceOf(ContextTooLargeError)` for `GroundedEnricher`,
`GroundedExtractor`, and `GroundedComposer`.

Confirm the full matrix from spec.md's Success Criteria (SC-001) by grepping each file:

```sh
for f in enricher extractor composer generator; do
  echo "== grounded-$f ==";
  for err in ModelUnavailableError ContextTooLargeError InvalidModelOutputError; do
    printf '  %s: ' "$err";
    grep -c "$err" "tests/unit/generators/grounded-$f.test.ts";
  done
done
```

**Expected outcome**: every count is >= 1 (12 of 12 component/error-type combinations).

## Validate User Story 2 (CI coverage summary)

Locally, confirm the coverage command still runs clean and produces the summary CI will
publish:

```sh
npm run test:coverage
```

**Expected outcome**: text table prints with Statements/Branches/Functions/Lines
percentages, exit code 0.

To validate the actual CI behavior, open a pull request against this branch (or push a
commit) and check the workflow run's **Summary** page in the GitHub Actions UI —
**expected outcome**: the coverage table appears there without checking out the branch
or running any command locally (SC-002).

## Full regression check before opening the PR

```sh
npm run quality   # lint + format:check + test + build
npm run test:coverage
```

**Expected outcome**: all green, and no drop in overall coverage from the 100%
statement/branch baseline established in PR #22 (SC-003 — zero regressions).

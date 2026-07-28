# Phase 0 Research: Generator Error-Path Coverage & CI Summary

No `[NEEDS CLARIFICATION]` markers were left in the Technical Context — this feature
reuses existing, already-decided project conventions throughout. This document records
the concrete decisions and the evidence for them.

## Decision 1: Reuse the existing per-generator error-test pattern verbatim

**Decision**: New tests in `grounded-enricher.test.ts`, `grounded-extractor.test.ts`,
and `grounded-composer.test.ts` follow the exact structure already proven in
`grounded-generator.test.ts`'s `'GroundedGenerator - lifecycle callbacks: failure
classification'` describe block: mock `parseMock.mockRejectedValueOnce(new
APIConnectionError({ message: 'network down' }))` from `openai/error.mjs` for
`ModelUnavailableError`, and construct with `maxContextTokens: 1` plus an oversized
input field for `ContextTooLargeError`, asserting `rejects.toBeInstanceOf(...)` and
(where the file already tests `onError` callback classification) the corresponding
`errorType` string.

**Rationale**: All four generators extend the same `GroundedCall` base
(`src/core/grounded-call.ts`), which already has 100% branch coverage for this exact
classification logic (verified in the prior coverage pass, PR #22). The generator-level
tests exist to prove each component's *own* wrapper/prompt-building code doesn't
accidentally swallow or reclassify these errors — not to re-verify the base class. Using
an identical pattern per component keeps that intent legible and keeps review/maintenance
cheap (one shape to recognize across 4 files).

**Alternatives considered**:
- *Shared/parameterized test helper across all 4 generator files* — rejected: each
  generator has a different `.generate()`/`.extract()`/`.compose()` request shape
  (`{context, question}` vs `{fields, message}` vs `{instructions, context}`), so a
  generic helper would need as much per-component configuration as just writing the
  test inline; the existing test files also don't use cross-file helpers today, so this
  would be a new, unrequested abstraction for no net simplification.
- *Testing only via the shared base class* — rejected: this is the status quo, and it's
  exactly what issue #5 says is insufficient (doesn't prove each component's own code
  path).

## Decision 2: `GroundedComposer`'s `ContextTooLargeError` test sizes the overflow via `instructions`, not `context`

**Decision**: Unlike the other three generators (which key their context-overflow test
off a `context`/`message` field), the `GroundedComposer` test sets
`instructions: 'a'.repeat(...)` to exceed `maxContextTokens`, since `context` is
optional support-only for this component (per `src/generators/grounded-composer.ts`)
and `instructions` is the field the prompt is always built from.

**Rationale**: Read `src/generators/grounded-composer.ts`: `compose()` calls
`assertContextWithinLimit` against a prompt built from `instructions` (always present)
and `context` (optional). Sizing the overflow via `instructions` guarantees the guard
trips regardless of whether `context` is supplied, matching the Edge Cases note in
spec.md.

**Alternatives considered**: Sizing via `context` — rejected, would only test the guard
in the presence-of-context case and contradicts the component's own "context is
optional support" design already covered by other tests in the same file (`'GroundedComposer
- context absent/empty/blank'`).

## Decision 3: Publish coverage via `$GITHUB_STEP_SUMMARY`, not an external service

**Decision**: Add one step to `.github/workflows/ci.yml` after the existing `Test` step:
run `npm run test:coverage` and append its console text-summary output to
`$GITHUB_STEP_SUMMARY` (GitHub Actions' built-in per-run Markdown summary, visible on
the run page and linked from the PR's checks tab — no extra permissions, no secrets, no
third-party account).

**Rationale**: Satisfies the issue's literal acceptance criterion ("even just a
badge/comment on PRs") and spec FR-006/FR-007/FR-008 (visible, non-blocking, no new
gate) with zero new dependencies or external services — `@vitest/coverage-v8` is
already a devDependency (added in PR #21) and `npm run test:coverage` already exists
and already produces a clean text table. `$GITHUB_STEP_SUMMARY` is a native GitHub
Actions feature (no marketplace Action needed), keeping the workflow's dependency
surface unchanged.

**Alternatives considered**:
- *Codecov/Coveralls* — rejected: requires an external account, a repo secret/token,
  and (for public visibility) usually a badge in the README; heavier than what issue #5
  asks for, and introduces a new external dependency this library-focused repo doesn't
  otherwise have.
- *A `coverage-comment` marketplace Action posting a PR comment* — rejected for the same
  reason (new marketplace Action dependency, extra `pull-requests: write` permission)
  when the built-in step summary already satisfies the acceptance criterion with no new
  moving parts. Can be revisited later if the maintainer wants PR-comment-specific
  visibility instead of/in addition to the run summary.
- *Failing CI below a coverage threshold* — explicitly rejected per spec FR-008/
  Assumptions: the issue and spec ask for visibility, not a new gate; introducing a
  threshold is a separate, larger decision (what threshold? per-file or aggregate?) the
  spec deliberately keeps out of scope.

## Decision 4: No production (`src/`) changes

**Decision**: This feature touches only `tests/unit/generators/*.test.ts`,
`.github/workflows/ci.yml`, and (conditionally) `CONTRIBUTING.md`.

**Rationale**: Confirmed via the existing 100%-branch-coverage pass (PR #22) that
`GroundedCall`'s error-classification logic is already correct for all three error
types; the gap is purely in per-generator test evidence and CI visibility, matching
spec.md's Assumptions section.

**Alternatives considered**: N/A — this is a direct consequence of Decision 1's finding,
not an independent choice.

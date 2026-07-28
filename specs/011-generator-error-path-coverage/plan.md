# Implementation Plan: Generator Error-Path Coverage & CI Summary

**Branch**: `011-generator-error-path-coverage` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-generator-error-path-coverage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Close the test-coverage and CI-visibility gaps reported in GitHub issue #5: add the
missing `ModelUnavailableError`/`ContextTooLargeError` unit tests to
`GroundedEnricher`, `GroundedExtractor`, and `GroundedComposer` (mirroring the pattern
already proven in `GroundedGenerator`'s test suite), and add a coverage step to the
existing CI workflow that publishes the `npm run test:coverage` summary to the GitHub
Actions run summary (`$GITHUB_STEP_SUMMARY`) on every push/PR — no new dependency, no
new merge gate, no production code changes.

## Technical Context

**Language/Version**: TypeScript (Node.js >=20, per `package.json` engines)

**Primary Dependencies**: Vitest 4 (+ `@vitest/coverage-v8`, already installed),
existing `vi.mock('openai', ...)` pattern for provider mocking — no new dependency

**Storage**: N/A

**Testing**: Vitest (`npm test`, `npm run test:coverage`) — this feature is itself
entirely test/CI additions

**Target Platform**: Node.js library; CI runs on GitHub Actions (`ubuntu-latest`)

**Project Type**: Library (single project, per existing repo structure)

**Performance Goals**: N/A (no runtime code changes)

**Constraints**: Zero real network calls in tests (project convention); no new CI merge
gate/threshold (per spec Assumptions — visibility only); no new external service
(Codecov etc.) — summary must render from the GitHub Actions UI alone

**Scale/Scope**: 4 generator test files touched (`grounded-enricher.test.ts`,
`grounded-extractor.test.ts`, `grounded-composer.test.ts`, and possibly
`grounded-generator.test.ts` if a fallbackValue-configured variant per FR-005 is
missing there too), 1 CI workflow file (`.github/workflows/ci.yml`), 1 doc file
(`CONTRIBUTING.md`) if the CI step list changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` in this repo is the unfilled template (no
project-specific principles have been ratified) — there are no constitution-defined
gates to check. The repo's de facto constitution is `CLAUDE.md` (provider parity,
backward compatibility, no real network calls in tests, README sync for public API
changes, doc-drift prevention). This feature: touches no provider code (parity N/A),
changes no default behavior (compat N/A), adds only mocked tests (network-calls rule
satisfied by construction — see Phase 0), touches no public API (README sync N/A), and
explicitly plans to update `CONTRIBUTING.md` if the CI step list changes (doc-drift
rule satisfied by FR-009). **No violations, no gate failures.**

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md, quickstart.md)
confirm no `src/` changes and no new dependencies — re-affirms no violations.

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
tests/
└── unit/
    └── generators/
        ├── grounded-enricher.test.ts    # add ModelUnavailableError + ContextTooLargeError cases
        ├── grounded-extractor.test.ts   # add ModelUnavailableError case
        ├── grounded-composer.test.ts    # add ModelUnavailableError + ContextTooLargeError cases
        └── grounded-generator.test.ts   # add fallbackValue-configured variant if FR-005 gap found

.github/
└── workflows/
    └── ci.yml                          # add coverage step publishing to $GITHUB_STEP_SUMMARY

CONTRIBUTING.md                          # update CI-gate description if steps change
```

**Structure Decision**: Existing single-project library layout (`src/`, `tests/unit/`,
`tests/contract/`) is unchanged — this feature adds test cases to existing generator
test files and one step to the existing CI workflow. No new directories, no `src/`
changes.

## Complexity Tracking

N/A — no Constitution Check violations.

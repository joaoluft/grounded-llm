# Feature Specification: Generator Error-Path Coverage & CI Summary

**Feature Branch**: `011-generator-error-path-coverage`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description: "Add integration test coverage for all three operational error paths (ModelUnavailableError, ContextTooLargeError, InvalidModelOutputError) across every GroundedCall-based generator (GroundedGenerator, GroundedEnricher, GroundedExtractor, GroundedComposer), and publish a test-coverage summary in CI so gaps like this are visible going forward. Closes GitHub issue #5."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every generator proves it surfaces all three operational errors (Priority: P1)

As a maintainer, when a generator component (`GroundedGenerator`, `GroundedEnricher`,
`GroundedExtractor`, `GroundedComposer`) is changed, I want the test suite to already
prove that a failed provider call, an oversized prompt, and a malformed/refused model
response each surface as their own distinct, documented error type
(`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError` respectively)
for that specific component — not just for the shared base class — so a regression that
accidentally swallows or misclassifies an error in one component's wrapper logic is
caught before merge, not discovered by a user in production.

**Why this priority**: This is the exact gap issue #5 reports. Without it, a component
that accidentally catches-and-converts an operational error into a fallback (or vice
versa) can ship silently. It is the core deliverable.

**Independent Test**: Can be fully tested by running the test suite and confirming each
of the four generator components has at least one passing test per error type — this is
independently verifiable per component without needing the CI change from User Story 2.

**Acceptance Scenarios**:

1. **Given** `GroundedEnricher` configured without a `fallbackValue`, **When** the
   underlying provider call rejects with a connection/availability failure, **Then** the
   call rejects with `ModelUnavailableError` (not a fallback, not a different error type).
2. **Given** `GroundedEnricher` configured with a `maxContextTokens` too small for the
   supplied content, **When** `.generate()` is invoked, **Then** the call rejects with
   `ContextTooLargeError` before any model call is attempted.
3. **Given** `GroundedExtractor` configured without a `fallbackValue`, **When** the
   underlying provider call rejects with a connection/availability failure, **Then** the
   call rejects with `ModelUnavailableError`.
4. **Given** `GroundedComposer` configured without a `fallbackValue`, **When** the
   underlying provider call rejects with a connection/availability failure, **Then** the
   call rejects with `ModelUnavailableError`.
5. **Given** `GroundedComposer` configured with a `maxContextTokens` too small for the
   supplied instructions/content, **When** `.compose()` is invoked, **Then** the call
   rejects with `ContextTooLargeError`.

---

### User Story 2 - Coverage is visible on every pull request without local setup (Priority: P2)

As a reviewer or contributor, I want to see a test-coverage summary directly on a pull
request, so gaps like the one in User Story 1 are visible during review instead of
requiring someone to run the coverage tool locally and notice the gap by hand (as
happened before issue #5 was filed).

**Why this priority**: Prevents this exact class of gap from recurring silently. Lower
priority than User Story 1 because it is a visibility/process improvement, not a
correctness fix — the underlying tests from User Story 1 have value even without it.

**Independent Test**: Can be fully tested by opening a pull request against this
repository and confirming a coverage summary appears without anyone running a local
command — independently verifiable of whether User Story 1's specific tests exist yet.

**Acceptance Scenarios**:

1. **Given** a pull request is opened or updated, **When** the CI workflow completes,
   **Then** a coverage summary (statement/branch/function/line percentages) is visible
   on the PR without the reviewer needing to check out the branch or run any command.
2. **Given** the coverage run fails to execute (e.g. a test throws unexpectedly), **When**
   CI runs, **Then** the build fails clearly rather than silently omitting the summary.

---

### Edge Cases

- A generator configured **with** a `fallbackValue`: operational errors (all three types)
  must still reject the call rather than resolve to the fallback — the fallback path is
  reserved for the model's own "insufficient context" verdict, not for technical
  failures. Existing behavior; new tests must not regress it.
- `GroundedComposer` has no `context` requirement (per its existing design, context is
  optional) — its `ContextTooLargeError` test must size the overflow using
  `instructions`/`baseContent` fields it actually accepts, not assume the same shape as
  `GroundedGenerator`.
- The coverage summary must not fail/block the PR merely for being below some arbitrary
  percentage — this feature is about **visibility**, not introducing a new merge gate
  (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST include at least one test per generator component
  (`GroundedEnricher`, `GroundedExtractor`, `GroundedComposer`) asserting that a
  provider-call failure surfaces as `ModelUnavailableError` for that component
  specifically (`GroundedGenerator` already has this).
- **FR-002**: The test suite MUST include at least one test for `GroundedEnricher` and
  for `GroundedComposer` asserting that an oversized prompt surfaces as
  `ContextTooLargeError` for that component specifically (`GroundedGenerator` and
  `GroundedExtractor` already have this).
- **FR-003**: The test suite MUST continue to include at least one test per generator
  component asserting a malformed/refused model response surfaces as
  `InvalidModelOutputError` (already satisfied for all four; must not regress).
- **FR-004**: New tests MUST mock the provider SDK exactly as existing tests in the
  affected file already do (no real network calls, placeholder credentials) per this
  project's testing conventions.
- **FR-005**: New tests MUST verify errors reject with a fallbackValue configured too
  (per the Edge Cases note), for at least the `ModelUnavailableError` case per
  component, so the fallback-vs-operational-error distinction stays covered going
  forward.
- **FR-006**: The CI workflow MUST execute the project's coverage tooling on every pull
  request and every push to the default branch.
- **FR-007**: The CI workflow MUST publish a human-readable coverage summary
  (statement/branch/function/line percentages) somewhere a reviewer sees without local
  setup (e.g. the CI run's summary view and/or a PR comment).
- **FR-008**: Publishing the coverage summary MUST NOT introduce a new pass/fail gate
  based on a coverage percentage threshold — it is a visibility improvement, not a new
  blocking check (see Assumptions).
- **FR-009**: `CONTRIBUTING.md` MUST be updated if the CI workflow's externally-visible
  steps change, so its description of the CI gate stays accurate (per this project's own
  prior fix for exactly this kind of drift).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four generator components have verifiable test evidence for all three
  operational error types (12 of 12 component/error-type combinations covered, up from
  7 of 12 today).
- **SC-002**: A reviewer can determine the test-coverage percentage of a pull request
  from the PR page itself, with zero local commands run.
- **SC-003**: The full existing test suite (288+ tests as of this feature's start) keeps
  passing with zero regressions and zero real network calls introduced.
- **SC-004**: A future contributor who removes or breaks an operational-error path in
  any one generator component causes a test failure in that component's own test file,
  not just in the shared base class's tests.

## Assumptions

- "Publish a coverage summary" (per the issue's own acceptance criteria: "even just a
  badge/comment on PRs") is satisfied by CI surfacing the existing `npm run
  test:coverage` output in a visible location; it does not require introducing a
  coverage-percentage merge gate, an external SaaS (e.g. Codecov), or a repository
  badge — those are heavier than what the issue asks for and are out of scope for this
  feature.
- "Applicable component" for each error type (per the issue's acceptance criteria)
  means all four generators for `ModelUnavailableError` and `InvalidModelOutputError`
  (all four call a model and can fail/return malformed output), and all four for
  `ContextTooLargeError` as well, since all four generators build a prompt subject to
  the shared `maxContextTokens` guard in `GroundedCall`.
- No production code in `src/` needs to change — the gap is in test coverage and CI
  visibility only, not in the runtime error-classification logic itself (already
  verified correct and at 100% branch coverage at the `GroundedCall`/provider-adapter
  layer).

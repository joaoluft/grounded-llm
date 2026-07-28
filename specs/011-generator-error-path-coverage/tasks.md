---
description: "Task list for Generator Error-Path Coverage & CI Summary"
---

# Tasks: Generator Error-Path Coverage & CI Summary

**Input**: Design documents from `/specs/011-generator-error-path-coverage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: This feature's deliverable *is* test coverage (per spec.md User Story 1) —
the "implementation" tasks below are themselves test-writing tasks, not
implementation-then-test pairs.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Single project (library) — `src/`, `tests/`, `.github/` at repository root, per
plan.md's Structure Decision. No new directories.

---

## Phase 1: Setup

**Purpose**: Confirm the starting baseline before adding tests, so any later failure is
attributable to this feature's changes.

- [X] T001 Run `npm test` and `npm run test:coverage` at the repo root and confirm
      288/288 passing and 100% statement/branch coverage (the baseline from PR #22),
      before making any changes.

**No Foundational phase**: this feature adds no shared infrastructure, no new
dependencies, and no new production code (`src/` is untouched, per plan.md). Each user
story below only edits its own test file(s) or the CI workflow, so user stories can
start immediately after T001 with no blocking prerequisites between them.

---

## Phase 2: User Story 1 - Every generator proves it surfaces all three operational errors (Priority: P1) 🎯 MVP

**Goal**: `GroundedEnricher`, `GroundedExtractor`, and `GroundedComposer` each get test
coverage for whichever of `ModelUnavailableError`/`ContextTooLargeError` they're
currently missing (see spec.md's gap table), following the pattern already proven in
`GroundedGenerator`'s test suite (research.md Decision 1).

**Independent Test**: Run the four generator test files and grep-count each error type
per file, per quickstart.md's "Validate User Story 1" section — all 12
component/error-type combinations must show >= 1.

### Implementation for User Story 1

- [X] T002 [P] [US1] In `tests/unit/generators/grounded-enricher.test.ts`, add
      `import { APIConnectionError } from 'openai/error.mjs';` and
      `ModelUnavailableError` to the existing `errors.js` import, then add a new
      `describe('GroundedEnricher - operational error paths (issue #5)', ...)` block
      (`beforeEach` resets `parseMock` and sets `process.env['OPENAI_API_KEY'] =
      'test-key'`, matching every other describe block in this file) with a test:
      `parseMock.mockRejectedValueOnce(new APIConnectionError({ message: 'network
      down' }))`, construct `new GroundedEnricher({ fallbackValue: 'N/A' })`, call
      `.generate({ baseContent: 'Thanks for your order!', context: 'Ships in 3
      business days.' })`, assert `rejects.toBeInstanceOf(ModelUnavailableError)`.

- [X] T003 [P] [US1] In the same new describe block from T002 (add
      `ContextTooLargeError` to the `errors.js` import), add a test: construct `new
      GroundedEnricher({ fallbackValue: 'N/A', maxContextTokens: 1 })`, call
      `.generate({ baseContent: 'a', context: 'a'.repeat(1000) })`, assert
      `rejects.toBeInstanceOf(ContextTooLargeError)` and `expect(parseMock).not
      .toHaveBeenCalled()`.

- [X] T004 [P] [US1] In `tests/unit/generators/grounded-extractor.test.ts`, add
      `import { APIConnectionError } from 'openai/error.mjs';` and
      `ModelUnavailableError` to the existing `errors.js` import, then add a test to
      the existing `describe('GroundedExtractor - lifecycle callbacks: failure
      classification (008-structured-logging-hooks US2)', ...)` block (around line
      341): `parseMock.mockRejectedValueOnce(new APIConnectionError({ message:
      'network down' }))`, construct `new GroundedExtractor({ fields, fallbackValue,
      onError })` (reusing the file's existing `fields`/`fallbackValue` constants),
      call `.extract({ message: "I'm Ada Lovelace" })`, assert
      `rejects.toBeInstanceOf(ModelUnavailableError)` and
      `onError.mock.calls[0][0].errorType` is `'model-unavailable'`.

- [X] T005 [P] [US1] In `tests/unit/generators/grounded-composer.test.ts`, add `import
      { APIConnectionError } from 'openai/error.mjs';` and `ModelUnavailableError` to
      the existing `errors.js` import, then add a test to the existing
      `describe('GroundedComposer - lifecycle callbacks: failure classification
      (008-structured-logging-hooks US2)', ...)` block (around line 361):
      `parseMock.mockRejectedValueOnce(new APIConnectionError({ message: 'network
      down' }))`, construct `new GroundedComposer({ onError })`, call
      `.compose({ instructions: 'Ask for the protocol.' })`, assert
      `rejects.toBeInstanceOf(ModelUnavailableError)` and
      `onError.mock.calls[0][0].errorType` is `'model-unavailable'`.

- [X] T006 [P] [US1] In the same describe block from T005 (add `ContextTooLargeError`
      to the `errors.js` import), add a test: construct `new GroundedComposer({
      maxContextTokens: 1 })`, call `.compose({ instructions: 'a'.repeat(1000) })`,
      assert `rejects.toBeInstanceOf(ContextTooLargeError)` and
      `expect(parseMock).not.toHaveBeenCalled()` — per research.md Decision 2, the
      overflow is sized via `instructions`, not `context`, since `context` is optional
      for this component.

- [X] T007 [US1] In `tests/unit/generators/grounded-composer.test.ts`, add one more
      test to the same describe block from T005/T006, adjacent to the existing
      `describe('GroundedComposer - ignores any configured fallbackValue (US1)', ...)`
      block's intent: `parseMock.mockRejectedValueOnce(new APIConnectionError({
      message: 'network down' }))`, construct `new GroundedComposer({ fallbackValue:
      'SHOULD_NEVER_APPEAR' })`, call `.compose({ instructions: 'Ask for the
      protocol.' })`, assert `rejects.toBeInstanceOf(ModelUnavailableError)` — proves
      the operational-error path is never short-circuited by Composer's fallback-
      ignoring design (spec.md Edge Cases, FR-005).

- [X] T008 [US1] Run the verification loop from quickstart.md's "Validate User Story 1"
      section and confirm all 12 of 12 component/error-type combinations across
      `grounded-enricher.test.ts`, `grounded-extractor.test.ts`,
      `grounded-composer.test.ts`, and `grounded-generator.test.ts` show count >= 1
      (spec.md SC-001).

**Checkpoint**: User Story 1 complete and independently verifiable — run `npx vitest
run tests/unit/generators/` and confirm all pass with zero real network calls.

---

## Phase 3: User Story 2 - Coverage is visible on every pull request without local setup (Priority: P2)

**Goal**: CI publishes the `npm run test:coverage` summary on every push/PR via the
GitHub Actions run summary — no new dependency, no new merge gate (research.md
Decision 3).

**Independent Test**: Open/update a pull request and confirm the coverage table
appears on the workflow run's Summary page without any local command.

### Implementation for User Story 2

- [X] T009 [US2] In `.github/workflows/ci.yml`, add a new step after the existing
      `Test` step (`run: npm test`) and before the `Build` step:
      ```yaml
      - name: Coverage summary
        run: npm run test:coverage -- --reporter=default | tee -a "$GITHUB_STEP_SUMMARY"
      ```
      (wrap the summary body in a Markdown code fence via two additional `echo` lines
      before/after the `tee`, or use `npm run test:coverage >> "$GITHUB_STEP_SUMMARY"`
      with a fenced heredoc — pick whichever renders the existing text-table reporter
      output legibly as Markdown; verify by inspecting a run's Summary tab). This step
      must not change the job's exit code semantics — a coverage-run failure (e.g. a
      test throws) must still fail the job (spec.md Acceptance Scenario 2 under US2),
      so do not swallow its exit code.

- [X] T010 [US2] Check whether `CONTRIBUTING.md`'s description of the CI gate ("CI
      (type-check + test + build)") needs updating to mention the new coverage-summary
      step, per FR-009. If the gate's pass/fail semantics are unchanged (this step is
      additive/visibility-only, not a new blocking check), update the wording only if
      it would otherwise be misleading; otherwise leave as-is and note in the PR
      description why no doc change was needed.

- [ ] T011 [US2] Push this branch (or open the PR) and confirm, on the resulting
      GitHub Actions run's Summary page, that the coverage table is visible without
      checking out the branch or running any command locally (spec.md SC-002,
      quickstart.md "Validate User Story 2").

**Checkpoint**: User Story 2 complete and independently verifiable via the Actions run
Summary page, regardless of whether User Story 1's new tests exist yet.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Full regression check and issue close-out.

- [X] T012 [P] Run `npm run quality` (lint + format:check + test + build) and confirm
      all green.
- [X] T013 [P] Run `npm run test:coverage` and confirm no regression from the 100%
      statement/branch baseline (spec.md SC-003).
- [ ] T014 Cross-check spec.md's Success Criteria (SC-001 through SC-004) and GitHub
      issue #5's original acceptance criteria are both fully satisfied; reference
      "Closes #5" in the pull request description.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first to confirm baseline.
- **User Story 1 (Phase 2)**: Depends only on Setup (T001). Independent of User Story 2.
- **User Story 2 (Phase 3)**: Depends only on Setup (T001). Independent of User Story 1
  — can be implemented before, after, or in parallel with Phase 2.
- **Polish (Phase 4)**: Depends on both user stories being complete.

### Within Each User Story

- T002–T007 (US1) touch three different test files and can run in parallel; T008 is a
  verification task that depends on all of T002–T007 being done.
- T009–T011 (US2) are sequential (each depends on the previous step's output).

### Parallel Opportunities

- T002+T003 (enricher), T004 (extractor), and T005+T006+T007 (composer) are three
  different files — all `[P]`, safe to do in parallel.
- T012 and T013 are independent commands, safe to run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all three generator test-file edits together (different files):
Task: "Add ModelUnavailableError + ContextTooLargeError tests to tests/unit/generators/grounded-enricher.test.ts"
Task: "Add ModelUnavailableError test to tests/unit/generators/grounded-extractor.test.ts"
Task: "Add ModelUnavailableError + ContextTooLargeError tests to tests/unit/generators/grounded-composer.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001).
2. Complete Phase 2: User Story 1 (T002–T008) — this alone closes the coverage-gap
   half of issue #5.
3. **STOP and VALIDATE**: run the full generator test suite; confirm 12/12 in the
   grep matrix.

### Incremental Delivery

1. Setup → baseline confirmed.
2. User Story 1 → per-generator error tests land, independently mergeable/reviewable.
3. User Story 2 → CI coverage summary lands, independently mergeable/reviewable.
4. Polish → full regression + issue close-out, single PR bundles both stories (per
   project convention of one PR per issue) but each story is independently reviewable
   within it.

## Notes

- No `src/` changes anywhere in this task list — confirmed by plan.md's Constitution
  Check and research.md Decision 4.
- Every new test must mock the provider SDK exactly as the surrounding tests in its
  file already do — no real network calls (FR-004, project-wide convention).
- Commit after each user story phase, not after every individual task, to keep the
  history readable (matches this repo's existing commit granularity).

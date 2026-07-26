# Tasks: Contributor Onboarding Documentation

**Input**: Design documents from `/specs/010-contributing-guide/`
**Prerequisites**: plan.md, research.md, quickstart.md, spec.md

**Tests**: Not requested — this is a documentation-only feature. Validation is manual,
via `quickstart.md`, not automated tests.

**Organization**: Tasks are grouped by user story from `spec.md` to enable independent
delivery and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1, US2, or US3 — maps to the user story this task serves
- File paths are repo-relative from `/home/joao/projects/grounded-llm`

## Phase 1: Setup

- [X] T001 Confirm `package.json` `engines.node` is present and accurate (already
      `">=20"`); no change needed unless it has drifted from CI's `node-version: "20"`.

## Phase 2: Foundational

*No blocking prerequisites beyond T001 — this feature has no shared code/schema to
scaffold before user stories can start.*

## Phase 3: User Story 1 - First-time contributor sets up the project (Priority: P1) 🎯 MVP

**Goal**: A contributor can go from `git clone` to passing `npm test` / clean
`npm run lint` using only `CONTRIBUTING.md`.

**Independent Test**: Follow `quickstart.md`'s "Steps" section on a clean clone; all four
commands (`npm install`, `npm run build`, `npm test`, `npm run lint`) succeed with no
other file consulted and no real API key set.

- [X] T002 [US1] Create `CONTRIBUTING.md` at repo root with an "Environment Setup"
      section: required Node.js version (`>=20`, from `package.json` `engines`), package
      manager (npm, per committed `package-lock.json`), and the exact commands
      `npm install`, `npm run build`, `npm test`, `npm run lint` in order (FR-002, FR-003).
- [X] T003 [US1] In `CONTRIBUTING.md`'s "Environment Setup" section, state explicitly
      that the test suite mocks provider SDKs (e.g. `vi.mock('openai', ...)`) and uses
      placeholder keys like `OPENAI_API_KEY=test-key`, so no real LLM provider API key is
      required to run tests locally (FR-004).
- [X] T004 [US1] In `CONTRIBUTING.md`, add a short pointer to `LINTER_SETUP.md` for
      detailed ESLint/Prettier configuration rather than duplicating it (Constraint from
      plan.md).

**Checkpoint**: At this point, `CONTRIBUTING.md` alone is sufficient to satisfy SC-001
and SC-002 — a contributor can clone, install, build, test, and lint successfully.

---

## Phase 4: User Story 2 - Contributor prepares a pull request that follows project conventions (Priority: P2)

**Goal**: A contributor can branch, commit, and open a PR that matches the project's
existing conventions on the first attempt.

**Independent Test**: Open a PR using only `CONTRIBUTING.md` and the generated
`.github/PULL_REQUEST_TEMPLATE.md`; branch name, commit style, and checklist match
documented conventions without maintainer correction.

- [X] T005 [P] [US2] Create `CODE_OF_CONDUCT.md` at repo root using the standard
      Contributor Covenant v2.1 text (FR-010).
- [X] T006 [US2] In `CONTRIBUTING.md`, add a "Branching" section documenting feature
      branches cut from `main`, named `<issue-number>-<short-slug>` (FR-005).
- [X] T007 [US2] In `CONTRIBUTING.md`, add a "Commit Messages" section documenting
      Conventional Commits prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
      `style:`) as observed in the project's git history (FR-006).
- [X] T008 [US2] In `CONTRIBUTING.md`, add a "Pull Request Checklist" section covering:
      tests passing, lint clean, and README updated when public API behavior changes
      (FR-007).
- [X] T009 [US2] In `CONTRIBUTING.md`, add a "Releasing" note that links to
      `README.md`'s existing "Releasing" section instead of duplicating its content
      (FR-008).
- [X] T010 [US2] In `CONTRIBUTING.md`, add a "Code of Conduct" note referencing
      `CODE_OF_CONDUCT.md` (depends on T005) (FR-009).
- [X] T011 [US2] Create `.github/PULL_REQUEST_TEMPLATE.md` with a checklist matching
      T008 (tests passing, lint clean, README updated when applicable) (FR-011).

**Checkpoint**: `CONTRIBUTING.md` now fully covers environment + collaboration
standards; opening a PR surfaces the matching checklist automatically.

---

## Phase 5: User Story 3 - Contributor reports a bug or requests a feature via GitHub Issues (Priority: P3)

**Goal**: New GitHub issues offer structured bug report and feature request templates
instead of a blank body.

**Independent Test**: On GitHub, "New issue" offers "Bug report" and "Feature request"
as selectable templates, each prompting for the relevant structured fields.

- [X] T012 [P] [US3] Create `.github/ISSUE_TEMPLATE/bug_report.md` prompting for
      reproduction steps, expected vs. actual behavior, and environment details (FR-012).
- [X] T013 [P] [US3] Create `.github/ISSUE_TEMPLATE/feature_request.md` prompting for
      the problem being solved and the proposed solution (FR-012).

**Checkpoint**: All three user stories are independently satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Add a short "Contributing" section to the English part of `README.md`
      linking to `CONTRIBUTING.md` (FR-013).
- [X] T015 [P] Add the equivalent "Contribuindo" section to the Portuguese part of
      `README.md` linking to `CONTRIBUTING.md` (FR-013).
- [X] T016 Manually walk through `quickstart.md` end-to-end (all three validation
      sections) on this branch to confirm SC-001 through SC-004 hold before opening the
      PR.

## Dependencies & Execution Order

- **Setup (T001)** has no dependencies.
- **US1 (T002-T004)** depends only on T001; delivers the MVP (SC-001, SC-002).
- **US2 (T005-T011)** builds on the `CONTRIBUTING.md` created in US1 (adds sections to
  the same file); T010 depends on T005 (CoC must exist before referencing it). T005 and
  T011 touch different files and can run in parallel with the rest of US2's edits.
- **US3 (T012-T013)** is fully independent of US1/US2 — different files
  (`.github/ISSUE_TEMPLATE/`), can be done in parallel with either.
- **Polish (T014-T016)** depends on US1 and US2 being complete (README references
  `CONTRIBUTING.md`; T016 validates everything together).

## Parallel Execution Examples

```text
# US2 and US3 can be worked in parallel once US1's CONTRIBUTING.md skeleton exists:
T005 [P] [US2] Create CODE_OF_CONDUCT.md
T012 [P] [US3] Create .github/ISSUE_TEMPLATE/bug_report.md
T013 [P] [US3] Create .github/ISSUE_TEMPLATE/feature_request.md

# Polish README edits are independent of each other:
T014 [P] Add English "Contributing" section
T015 [P] Add Portuguese "Contribuindo" section
```

## Implementation Strategy

**MVP first**: Complete Phase 1 + Phase 3 (T001-T004) and stop — this alone satisfies
the issue's core acceptance criteria (a contributor can set up and test using only
`CONTRIBUTING.md`). Phases 4-6 round out collaboration standards and GitHub templates
per the issue's full deliverable list, and should be completed in the same PR since the
issue requests all deliverables together.

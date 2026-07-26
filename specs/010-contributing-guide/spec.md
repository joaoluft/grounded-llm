# Feature Specification: Contributor Onboarding Documentation

**Feature Branch**: `4-document-local-environment-setup-and-contribution-standards`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Document local environment setup and contribution standards. Issue: no CONTRIBUTING.md exists, forcing first-time contributors to reverse-engineer setup from package.json, LINTER_SETUP.md, and CI workflow. Need a single onboarding doc covering: Environment (required Node.js/npm/pnpm versions from package.json engines field, add if missing; required env vars for running tests locally - e.g. whether a real OPENAI_API_KEY is needed or model calls are mocked; steps to install/build/test/lint: npm install, npm run build, npm test, npm run lint). Collaboration standards (branching convention - feature branches off main, naming; commit message convention if any; PR checklist - tests passing, lint clean, README updated when public API changes; how releases are cut - link to README's existing "Releasing" section rather than duplicating; Code of Conduct - add standard CODE_OF_CONDUCT.md if none exists). Deliverables: CONTRIBUTING.md at repo root, .github/PULL_REQUEST_TEMPLATE.md, .github/ISSUE_TEMPLATE/bug_report.md and feature_request.md, README gets a short "Contributing" section linking to CONTRIBUTING.md. Acceptance criteria: a contributor with zero prior context can clone, set up, and run the full test suite using only CONTRIBUTING.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time contributor sets up the project (Priority: P1)

A developer with no prior context clones the repository, intending to fix a bug or pick up
a "good first issue." They need to go from a fresh clone to a passing local test run
without reading source code, CI YAML, or asking a maintainer.

**Why this priority**: This is the core problem the issue describes — onboarding currently
requires reverse-engineering `package.json`, `LINTER_SETUP.md`, and the CI workflow. Without
this, contributors either give up or ask questions that a doc should answer.

**Independent Test**: Can be fully tested by having someone unfamiliar with the repo follow
only `CONTRIBUTING.md` from `git clone` through `npm test` passing and `npm run lint`
reporting no errors, with no other files consulted.

**Acceptance Scenarios**:

1. **Given** a fresh clone of the repository, **When** the contributor follows the
   "Environment" steps in `CONTRIBUTING.md`, **Then** they install the correct Node.js
   version, run `npm install`, `npm run build`, `npm test`, and `npm run lint`, and all
   succeed without needing a real LLM provider API key.
2. **Given** the contributor is unsure whether tests call real external services,
   **When** they read `CONTRIBUTING.md`, **Then** the doc states explicitly that tests
   mock provider SDKs and use placeholder API keys, so no real credentials are required.

---

### User Story 2 - Contributor prepares a pull request that follows project conventions (Priority: P2)

A contributor who has made a code change wants to open a PR that will pass review on the
first attempt: correct branch name, commit style, and a self-check of the same gates CI
runs.

**Why this priority**: Reduces back-and-forth review cycles caused by inconsistent branch
names, commit messages, or missed lint/test/README updates — a recurring cost once setup
itself is no longer the blocker.

**Independent Test**: Can be tested by having a contributor open a PR using only
`CONTRIBUTING.md` and the generated `.github/PULL_REQUEST_TEMPLATE.md`, and confirming the
branch name, commit message, and checklist match documented conventions without maintainer
correction.

**Acceptance Scenarios**:

1. **Given** the contributor is starting work on an issue, **When** they read the
   "Branching" section, **Then** they create a feature branch off `main` named after the
   issue (number + short slug), matching the convention already used in the repository's
   history.
2. **Given** the contributor is about to commit, **When** they read the "Commit messages"
   section, **Then** they follow the Conventional Commits style (`feat:`, `fix:`, `docs:`,
   `chore:`, etc.) already used in the project's git log.
3. **Given** the contributor opens a pull request, **When** the PR template loads, **Then**
   it prompts them to confirm tests pass, lint is clean, and the README is updated if
   public API behavior changed.

---

### User Story 3 - Contributor reports a bug or requests a feature via GitHub Issues (Priority: P3)

A user who is not yet contributing code wants to file a well-structured bug report or
feature request instead of an empty free-form issue.

**Why this priority**: Improves the quality of incoming issues (which downstream feeds
future "good first issue" work) but is lower priority than unblocking code contribution
itself.

**Independent Test**: Can be tested by opening a new issue on GitHub and confirming the
bug report and feature request templates are offered as choices, each prompting for the
relevant structured fields.

**Acceptance Scenarios**:

1. **Given** a user wants to report a bug, **When** they click "New issue," **Then** a
   "Bug report" template is available prompting for reproduction steps, expected vs.
   actual behavior, and environment details.
2. **Given** a user wants to request a feature, **When** they click "New issue," **Then**
   a "Feature request" template is available prompting for the problem being solved and
   the proposed solution.

### Edge Cases

- What happens when a contributor has an incompatible Node.js version installed? The doc
  must state the minimum required version explicitly (from `package.json` `engines`) so
  the mismatch is diagnosable without reading `package.json`.
- What happens when a contributor's change doesn't touch the public API? The PR checklist
  item about updating the README must be clearly conditional, not a blanket requirement.
- What happens when a contributor looks for release/versioning instructions? The doc must
  link to the README's existing "Releasing" section rather than duplicating it, so the two
  never drift out of sync.
- What happens when no `CODE_OF_CONDUCT.md` exists yet (current state)? A standard one
  must be added and referenced from `CONTRIBUTING.md`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a `CONTRIBUTING.md` at the repository root
  covering environment setup and collaboration standards in a single document.
- **FR-002**: `CONTRIBUTING.md` MUST state the required Node.js version, sourced from
  `package.json`'s `engines` field (adding the field if it is missing a package manager
  constraint).
- **FR-003**: `CONTRIBUTING.md` MUST state which package manager and lockfile the project
  uses (npm, per the committed `package-lock.json`) and give the exact commands to
  install, build, test, and lint: `npm install`, `npm run build`, `npm test`,
  `npm run lint`.
- **FR-004**: `CONTRIBUTING.md` MUST state whether real LLM provider API keys are required
  to run the test suite, reflecting that tests mock provider SDKs and use placeholder
  keys, so contributors never need real credentials to run tests locally.
- **FR-005**: `CONTRIBUTING.md` MUST document the branching convention: feature branches
  cut from `main`, named `<issue-number>-<short-slug>` matching the issue title.
- **FR-006**: `CONTRIBUTING.md` MUST document the commit message convention used in this
  project (Conventional Commits prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
  `style:`, etc.).
- **FR-007**: `CONTRIBUTING.md` MUST include a PR checklist covering: tests passing, lint
  clean, and README updated when a change affects the public API.
- **FR-008**: `CONTRIBUTING.md` MUST link to the README's existing "Releasing" section for
  release/versioning steps rather than duplicating that content.
- **FR-009**: `CONTRIBUTING.md` MUST reference a Code of Conduct that contributors are
  expected to follow.
- **FR-010**: The repository MUST provide a standard `CODE_OF_CONDUCT.md` at the
  repository root, since none currently exists.
- **FR-011**: The repository MUST provide `.github/PULL_REQUEST_TEMPLATE.md` reflecting
  the PR checklist from FR-007.
- **FR-012**: The repository MUST provide `.github/ISSUE_TEMPLATE/bug_report.md` and
  `.github/ISSUE_TEMPLATE/feature_request.md` structured issue templates.
- **FR-013**: The README MUST include a short "Contributing" section linking to
  `CONTRIBUTING.md`, added to both the English and Portuguese sections of the README.

### Key Entities

- **CONTRIBUTING.md**: The onboarding document; sections are Environment Setup and
  Collaboration Standards (branching, commits, PR checklist, releases, code of conduct).
- **CODE_OF_CONDUCT.md**: Standard community behavior standard, referenced from
  `CONTRIBUTING.md`.
- **PULL_REQUEST_TEMPLATE.md**: GitHub PR description template enforcing the PR checklist.
- **Issue templates (bug_report.md, feature_request.md)**: Structured GitHub issue forms
  under `.github/ISSUE_TEMPLATE/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor with zero prior context can go from `git clone` to a passing
  local test run (`npm test`) and clean lint run (`npm run lint`) using only
  `CONTRIBUTING.md`, with zero additional files consulted.
- **SC-002**: 100% of the setup commands listed in `CONTRIBUTING.md` (install, build, test,
  lint) succeed when run in order on a clean clone with the documented Node.js version.
- **SC-003**: New pull requests opened after this change use the generated PR template
  (verifiable by the template's checklist appearing pre-filled in the PR description).
- **SC-004**: New GitHub issues opened after this change offer a choice between the bug
  report and feature request templates instead of a blank issue body.

## Assumptions

- The project uses npm (not pnpm/yarn) as its package manager, based on the committed
  `package-lock.json`; no pnpm-specific instructions are needed.
- Tests do not require real provider API keys: existing tests mock the `openai` SDK
  and set placeholder values such as `OPENAI_API_KEY=test-key`.
- The required Node.js version is `>=20`, per `package.json`'s existing `engines.node`
  field; no separate `.nvmrc` currently exists and adding one is out of scope unless
  needed to satisfy FR-002.
- A standard, widely-recognized Code of Conduct (Contributor Covenant) is an acceptable
  default text for `CODE_OF_CONDUCT.md`, since the issue does not specify custom content.
- `LINTER_SETUP.md` remains as supplementary detail on ESLint/Prettier configuration;
  `CONTRIBUTING.md` references it rather than duplicating its content.
- This is a documentation-only feature: no source code, build tooling, or test behavior
  changes are required.

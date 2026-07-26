# Quickstart: Validating the Contributor Onboarding Documentation

This validates User Story 1 (SC-001, SC-002 in [spec.md](./spec.md)): a contributor with
zero prior context can go from `git clone` to a passing local test run using only
`CONTRIBUTING.md`.

## Prerequisites

- A clean clone of the repository (no prior `node_modules`, no environment variables set).
- Node.js version matching the requirement stated in `CONTRIBUTING.md` (`>=20`).

## Steps

1. Clone the repo and `cd` into it.
2. Open only `CONTRIBUTING.md` — do not consult `package.json`, `LINTER_SETUP.md`, or
   `.github/workflows/ci.yml`.
3. Follow the "Environment Setup" section's commands in order:
   ```sh
   npm install
   npm run build
   npm test
   npm run lint
   ```
4. Confirm each command exits successfully (`npm test` reports all tests passing,
   `npm run lint` reports no errors) without setting any real provider API key.

## Expected Outcome

- All four commands succeed with no additional setup steps beyond what
  `CONTRIBUTING.md` states.
- The contributor never needed to open `package.json`'s `engines` field, CI YAML, or
  ask a maintainer what Node version or API keys are required.

## Validating User Story 2 (PR conventions)

1. Create a branch named `<issue-number>-<slug>` per the "Branching" section.
2. Make a commit using a Conventional Commits prefix per the "Commit Messages" section.
3. Open a draft PR on GitHub and confirm `.github/PULL_REQUEST_TEMPLATE.md` pre-fills the
   description with the tests/lint/README checklist.

## Validating User Story 3 (issue templates)

1. On GitHub, click "New issue" on the repository.
2. Confirm "Bug report" and "Feature request" both appear as selectable templates (not
   just a blank issue).
3. Open each and confirm the prompted fields match what `spec.md` describes (repro steps
   / expected vs actual for bugs; problem / proposed solution for features).

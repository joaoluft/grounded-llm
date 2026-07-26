# Research: Contributor Onboarding Documentation

## Decision: Package manager & Node version to document

**Decision**: Document npm (not pnpm/yarn) with Node `>=20`.

**Rationale**: `package-lock.json` is the only lockfile committed; `package.json` already
declares `"engines": { "node": ">=20" }`; CI (`.github/workflows/ci.yml`) uses
`actions/setup-node` with `node-version: "20"` and `cache: "npm"`. All signals agree.

**Alternatives considered**: Documenting pnpm — rejected, no `pnpm-lock.yaml` exists and
would contradict the committed lockfile.

## Decision: Whether real provider API keys are needed to run tests

**Decision**: State that no real API keys are required; tests mock provider SDKs.

**Rationale**: Confirmed via `grep -rn "vi.mock('openai'" tests/` (e.g.
`tests/unit/core/grounded-call.test.ts:30`) and widespread use of placeholder values like
`process.env['OPENAI_API_KEY'] = 'test-key'` across the unit test suite. No test reaches
a real network endpoint.

**Alternatives considered**: None — this is a factual question with one correct answer,
verified directly against the test suite rather than assumed.

## Decision: Branching convention to document

**Decision**: Feature branches cut from `main`, named `<issue-number>-<slug-of-title>`.

**Rationale**: `git branch -a` shows `4-document-local-environment-setup-and-contribution-standards`,
`6-add-token-usage-cost-metadata-to-groundedresult`,
`8-add-structured-logging-hooks-oncall-onresult-onerror`,
`10-pluggable-result-cache-to-prevent-redundant-duplicate-calls` — all following this
exact pattern, which matches GitHub's auto-suggested branch name when creating a branch
from an issue.

**Alternatives considered**: Generic `feature/xyz` convention — rejected, doesn't match
actual repo history.

## Decision: Commit message convention to document

**Decision**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
`style:`, etc.), with an optional trailing issue reference.

**Rationale**: `git log --oneline` shows consistent use of these prefixes:
`feat: add pluggable result cache...`, `fix: harden result cache...`,
`style: unify usage param type...`, `feat: surface token usage metadata... (#6)`.

**Alternatives considered**: Free-form commit messages — rejected, doesn't reflect
observed practice.

## Decision: Releasing section — link vs. duplicate

**Decision**: `CONTRIBUTING.md` links to `README.md#releasing` rather than repeating its
content.

**Rationale**: Issue explicitly requests linking rather than duplicating. README already
documents the full release flow (`npm version patch|minor|major`, tag push, CI/release
workflow, `NPM_TOKEN` requirement) in its "Releasing" section (English) and "Releases"
section (Portuguese) — duplicating risks drift.

**Alternatives considered**: Copying release steps into CONTRIBUTING.md — rejected per
issue instructions and DRY concerns.

## Decision: Code of Conduct content

**Decision**: Adopt the standard Contributor Covenant v2.1 text for `CODE_OF_CONDUCT.md`.

**Rationale**: Issue asks for "a standard CODE_OF_CONDUCT.md if none exists" — Contributor
Covenant is the de facto standard for open source projects on GitHub and requires no
project-specific customization beyond a contact method.

**Alternatives considered**: Writing a custom code of conduct — rejected as unnecessary
scope for a "good first issue"-labeled documentation task.

## Decision: Issue/PR template format

**Decision**: Plain Markdown templates (`.md`), not YAML issue forms.

**Rationale**: Issue explicitly names `.github/ISSUE_TEMPLATE/bug_report.md` and
`feature_request.md` (Markdown extensions), and `.github/PULL_REQUEST_TEMPLATE.md` — the
classic GitHub template format, simplest to review and edit for a small repo.

**Alternatives considered**: YAML-based issue forms (`.github/ISSUE_TEMPLATE/*.yml`) —
rejected, not what the issue asked for and adds unnecessary schema complexity for this
repo's size.

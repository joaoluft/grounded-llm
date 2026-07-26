# Contributing to grounded-llm

Thanks for your interest in contributing! This guide covers everything you need to go
from a fresh clone to an opened pull request.

By participating in this project, you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Environment Setup

**Requirements**:

- Node.js `>=20` (see `engines` in [`package.json`](./package.json); CI runs on Node 20).
- npm (this project commits `package-lock.json`, not a pnpm/yarn lockfile — use npm).

**No real LLM provider API key is required to run the test suite.** The test suite mocks
provider SDKs (e.g. `vi.mock('openai', ...)`) and uses placeholder values such as
`OPENAI_API_KEY=test-key`. You never need a real OpenAI, Anthropic, or Google API key to
develop or test this project locally.

**Install, build, test, lint** — run these in order from a fresh clone:

```sh
npm install
npm run build
npm test
npm run lint
```

Other useful scripts:

```sh
npm run test:watch    # vitest in watch mode
npm run lint:fix      # auto-fix lint errors
npm run format        # format with Prettier
npm run format:check  # check formatting without writing
npm run quality       # lint + format:check + test + build (same gate as CI)
```

For details on the ESLint/Prettier setup itself (rules, ignored paths, editor config),
see [`LINTER_SETUP.md`](./LINTER_SETUP.md).

## Collaboration Standards

### Branching

Cut feature branches from `main`, named `<issue-number>-<short-slug>` matching the
issue title (e.g. `4-document-local-environment-setup-and-contribution-standards`). This
matches GitHub's auto-suggested branch name when you create a branch directly from an
issue.

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes:

- `feat:` — a new feature
- `fix:` — a bug fix
- `docs:` — documentation only changes
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `style:` — formatting, whitespace, or non-functional changes
- `chore:` — tooling, dependencies, or maintenance

Example: `feat: add pluggable result cache to skip redundant pipeline calls`

### Pull Request Checklist

Before opening a PR, confirm:

- [ ] Tests pass (`npm test`).
- [ ] Lint is clean (`npm run lint`).
- [ ] `README.md` is updated if your change affects the public API (exported types,
      generator options, or documented behavior).

The PR template pre-fills this checklist for you.

### Releasing

Releases are cut by maintainers from `main`. The full release process (version bump,
tagging, npm publish via `.github/workflows/release.yml`) is already documented in the
README's [Releasing](./README.md#releasing) section — see that instead of duplicating
it here.

### Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Please read it
before participating.

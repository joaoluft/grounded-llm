# CLAUDE.md

Guidance for Claude (and for the automated code-review agent) working in this repo.

## Project

`grounded-llm` — TypeScript library that reduces LLM hallucination by forcing literal
fact extraction and an explicit sufficiency check before generating a final answer.
Multi-provider: OpenAI (default), Anthropic, Google, via `LLMProviderContract`
(`src/providers/`). Core pipeline: `src/core/grounded-call.ts`. Generators built on top
of it: `src/generators/grounded-{generator,enricher,extractor,composer}.ts`.

## Conventions

- Branch naming: `<issue-number>-<slug>`, cut from `main`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `style:`).
- File naming: kebab-case (not PascalCase/camelCase).
- No `any` in `src/` or `tests/` (ESLint warns via `@typescript-eslint/no-explicit-any`)
  — type it properly instead of suppressing.
- Package manager is npm (`package-lock.json` is committed) — do not add a pnpm/yarn
  lockfile.
- See `CONTRIBUTING.md` for full setup/PR workflow, `LINTER_SETUP.md` for lint config.

## Code Review Checklist

The automated code-review agent MUST check every PR against these project-specific
invariants, in addition to general bug-hunting:

1. **Provider parity** — any change to shared pipeline behavior (`src/core/*`,
   generator options, output shape) must work consistently across all three providers
   (`src/providers/openai.ts`, `anthropic.ts`, `google.ts`), not just OpenAI. A change
   that special-cases one provider without updating `LLMProviderContract` or the other
   two adapters is a bug.
2. **Backward compatibility** — `provider` defaults to `'openai'`; existing configs that
   don't set `provider` must keep working unchanged. Flag any change that alters
   default behavior without a documented reason.
3. **No real network calls in tests** — tests must mock provider SDKs (e.g.
   `vi.mock('openai', ...)`) and use placeholder credentials (e.g.
   `OPENAI_API_KEY=test-key'`). A test that would hit a real provider endpoint is a bug.
4. **`fallbackValue` handling** — must be returned verbatim (not mutated or
   re-serialized) on insufficient-context paths, and must not collide with cache keys
   for different inputs (see the result-cache fix in
   `src/core/result-cache.ts` history for the shape of this class of bug).
5. **Public API changes require README updates** — if a PR adds/changes an exported
   type, generator option, or documented behavior, `README.md` must be updated in
   **both** the English and Português sections, or the PR is incomplete.
6. **Error handling** — errors from provider SDKs must surface through this project's
   own error types (`src/core/errors.ts`, `src/providers/*` error mapping), not leak
   raw SDK exceptions to callers.
7. **Cache correctness** — for any change touching `src/core/result-cache.ts` or its
   usage in `src/core/grounded-call.ts`: cache `get` returning `undefined`/`null` must
   be treated as a miss, not crash; cache keys must incorporate every input that affects
   the result (including `fallbackValue`).
8. **Docs stay linked, not duplicated** — `CONTRIBUTING.md` must link to README's
   "Releasing" section rather than re-describing the release process; don't reintroduce
   duplication that can drift.

Issues found against this checklist should be reported the same way as other findings
(file/line citation, confidence score) — this section exists so the review agent has an
explicit, testable list of this app's invariants instead of relying on generic bug-hunting
alone.

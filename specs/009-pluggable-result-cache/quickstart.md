# Quickstart: Pluggable Result Cache

## Prerequisites

- Repo checked out on branch `10-pluggable-result-cache-to-prevent-redundant-duplicate-calls`
- `npm install`
- A model provider API key available as `OPENAI_API_KEY` (or use a mocked
  `ModelClient`/provider adapter in tests — see `tests/unit/generators/` for the existing
  mocking pattern)

## Validate: cache hit skips the pipeline

1. Run the new unit tests once implemented:
   ```bash
   npm test -- tests/unit/core/result-cache.test.ts
   npm test -- tests/unit/generators
   ```
   Expected: all pass, including assertions that a second identical call does not invoke
   the mocked provider a second time (User Story 1, FR-004).

2. Manual/integration sanity check (Node REPL or a scratch script), using a real or mocked
   provider:
   ```ts
   import { GroundedGenerator } from './src/index.js';

   const calls: unknown[] = [];
   const store = new Map<string, unknown>();

   const generator = new GroundedGenerator({
     apiKey: process.env.OPENAI_API_KEY,
     cache: {
       get: (key) => store.get(key),
       set: (key, value) => void store.set(key, value),
     },
     onCall: (e) => calls.push(e),
   });

   const context = 'Paris is the capital of France.';
   const question = 'What is the capital of France?';

   const first = await generator.generate({ context, question });
   const second = await generator.generate({ context, question });

   console.assert(JSON.stringify(first) === JSON.stringify(second), 'results must match');
   console.assert(calls.length === 2, 'onCall still fires for both calls (FR-009)');
   console.assert(store.size === 1, 'only one cache entry was written');
   ```
   Expected: exactly one model provider call occurs (verifiable via provider request logs
   or a mock's call count), yet both `generate()` calls resolve with equal results.

## Validate: no cache configured is unaffected

```ts
const generator = new GroundedGenerator({ apiKey: process.env.OPENAI_API_KEY });
const a = await generator.generate({ context, question });
const b = await generator.generate({ context, question });
```
Expected: the pipeline (and a real provider call) runs for both `a` and `b` — no caching
behavior, matching pre-feature behavior exactly (SC-002).

## Validate: cache backend failure never fails the request

```ts
const generator = new GroundedGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  cache: {
    get: () => { throw new Error('store unreachable'); },
    set: () => { throw new Error('store unreachable'); },
  },
});

const result = await generator.generate({ context, question });
```
Expected: `generate()` resolves normally with a real result — the thrown cache errors are
swallowed internally (FR-007, SC-005).

## Validate: different requests never collide

```ts
const r1 = await generator.generate({ context, question: 'What is the capital of France?' });
const r2 = await generator.generate({ context, question: 'What is the capital of Germany?' });
```
Expected: two distinct pipeline runs and two distinct results — a cache keyed on the
wrong fields would incorrectly return `r1` for the second call (SC-004).

## References

- Contract: [contracts/result-cache.md](./contracts/result-cache.md)
- Key composition: [data-model.md](./data-model.md#cache-key-derived-value)
- Design rationale: [research.md](./research.md)

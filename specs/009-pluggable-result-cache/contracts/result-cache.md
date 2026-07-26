# Contract: Result Cache

## Public TypeScript interface

```ts
export interface ResultCache {
  get(key: string): unknown | undefined | Promise<unknown | undefined>;
  set(key: string, value: unknown): void | Promise<void>;
}
```

Added to `GroundedCallConfig<TFallback>`:

```ts
export interface GroundedCallConfig<TFallback = string> {
  // ...existing fields unchanged...

  /**
   * Optional pluggable result cache. When configured, an identical repeated call
   * (same request content and output-affecting config) returns the cached result
   * without running the pipeline or contacting the model provider. The library is
   * storage-agnostic — bring your own in-memory Map, Redis client, etc — and is not
   * responsible for invalidation/expiry; that is the caller's policy to implement
   * (009-pluggable-result-cache FR-001..FR-008).
   */
  cache?: ResultCache;
}
```

## Behavioral contract

1. **No cache configured** (`cache` is `undefined`): every call runs the full pipeline,
   with no attempt to read or write any cache. Identical to pre-feature behavior
   (FR-001, SC-002).

2. **Cache configured, key not found** (`get` resolves to `undefined`, or throws/rejects):
   the pipeline runs in full. On success, the result is written via `set(key, result)`
   before being returned. A `set` failure (throw/reject) does not affect the returned
   result (FR-005, FR-007).

3. **Cache configured, key found** (`get` resolves to a value other than `undefined`):
   the pipeline does **not** run — no provider call is made. The resolved value is
   returned directly as the call's result. `onCall`/`onResult` still fire, reporting the
   real (cached) outcome (FR-004, FR-009).

4. **Key derivation** is entirely internal to the library — callers never construct or
   see cache keys directly. Two calls are represented by the same key if and only if they
   have equivalent request content and output-affecting instance configuration, per
   `data-model.md`'s Cache Key table (FR-003).

5. **Cross-generator isolation**: keys are namespaced by operation, so no cache entry
   produced by one generator type (e.g. `GroundedGenerator`) can ever be returned for a
   call to a different generator type (e.g. `GroundedComposer`), even given colliding
   request field values.

## Example usage (illustrative — not part of the library)

```ts
const store = new Map<string, unknown>();

const generator = new GroundedGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  cache: {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
  },
});

// First call: runs the full pipeline, stores the result under its derived key.
const first = await generator.generate({ context, question });

// Second, identical call: returned from `store` — no pipeline run, no provider call.
const second = await generator.generate({ context, question });
```

## Non-goals (explicitly out of contract)

- No TTL, eviction, or invalidation API — the caller's `ResultCache` implementation owns
  this entirely (FR-006).
- No cache statistics/introspection API (hit rate, size, etc) exposed by the library.
- No default/bundled cache implementation ships with the library.

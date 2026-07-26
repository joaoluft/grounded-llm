# Research: Pluggable Result Cache

## Decision 1: Interception point

**Decision**: Extend the existing `withLifecycle` wrapper (`src/core/grounded-call.ts`,
introduced in 008-structured-logging-hooks) with an optional `cacheKey` parameter, rather
than adding a separate wrapper or checking the cache inside each generator's `do*`
method.

**Rationale**: `withLifecycle` already sits directly around every generator's public
entry point (`generate`/`extract`/`compose`) and already owns the "does the real pipeline
run" decision boundary — it currently always calls `fn()`. Adding the short-circuit here
means `onCall`/`onResult` keep firing correctly for a cache hit (spec FR-009) for free,
instead of having to duplicate that logic in four places. It also means a cache hit and a
cache miss share one code path for hook dispatch, so there's no risk of the two drifting
out of sync as new hook behavior is added later.

**Alternatives considered**:
- *Wrap at the public method level, outside `withLifecycle`*: rejected — would require
  each of the four `generate`/`extract`/`compose` methods to duplicate the "check cache,
  else call withLifecycle, else store" logic, and `onCall` would fire even on a path that
  bypasses `withLifecycle` entirely on a hit, needing its own duplicate hook dispatch.
- *Check the cache inside each `do*` method*: rejected — `do*` methods run the actual
  extract/judge/answer/explain steps; checking cache there means the pipeline has already
  started (e.g. partial provider calls) before a hit could be detected, defeating the
  purpose (spec FR-004 requires the pipeline not execute at all on a hit).

## Decision 2: Key derivation

**Decision**: Each generator builds a plain object of the fields that affect its output
(its request's content fields, plus this instance's `identity`/`rules`/`tone`,
`model`/`temperature`, and — for `GroundedExtractor` — `fields`/`strict`), then passes it
to a new shared helper `deriveCacheKey(operation, input)` in `src/core/result-cache.ts`.
That helper stable-stringifies the object (keys sorted recursively, so field order never
affects the key) and hashes it with `node:crypto`'s `createHash('sha256')`, returning a
hex digest prefixed with the operation name (e.g.
`GroundedGenerator.generate:3f2a...`).

**Rationale**: A stable-stringify + hash approach is deterministic, has no new
dependency, produces a fixed-length key regardless of input size (friendly to real cache
backends with key-length limits, e.g. some Redis-compatible stores), and naturally
satisfies FR-003's requirement that equivalent content always produces the same key while
any output-affecting difference changes it. Prefixing with the operation name keeps keys
from the four different generators from ever colliding even if their request shapes
happened to serialize identically. `model`/`temperature` are included even though the
issue text only calls out `identity`/`rules`/`tone` explicitly, because they are equally
output-affecting (constitution principle 6, temperature-zero-by-default, is reinforced by
this — a non-default temperature changes the key). Config fields that do not affect
output (e.g. `client`, `apiKey`, `maxContextTokens`, callbacks) are excluded.

**Alternatives considered**:
- *Plain `JSON.stringify` without key-sorting*: rejected — `JSON.stringify` preserves
  insertion order, so two logically-identical objects built with fields in a different
  order would hash differently, undermining "identical request" (spec FR-003, Edge
  Cases).
- *Let the caller supply their own key function*: rejected — adds a second configuration
  surface and a second way to get FR-003 wrong; the issue explicitly asks for the library
  to define the key deterministically, leaving only storage pluggable.
- *Include full config object as the key input*: rejected — would make cache keys
  sensitive to fields with no effect on output (like `onCall`, which is a function and
  isn't even serializable), causing needless cache misses or serialization errors.

## Decision 3: Cache contract shape and sync/async support

**Decision**: `ResultCache` is a minimal structural interface:
```ts
interface ResultCache {
  get(key: string): unknown | undefined | Promise<unknown | undefined>;
  set(key: string, value: unknown): void | Promise<void>;
}
```
`withLifecycle` always `await`s both calls (`await this.cache.get(key)` /
`await this.cache.set(key, value)`), which works uniformly whether the caller's
implementation returns a value/`void` synchronously or a `Promise` — `await` on a
non-Promise value simply resolves to that value on the next microtask.

**Rationale**: This mirrors the issue's requested shape (`{ get(key), set(key, value) }`)
exactly and satisfies FR-002 (no other capability required) and FR-008 (async-capable
without adapting a sync interface) with no branching needed in `withLifecycle` — `await`
handles both cases identically.

**Alternatives considered**:
- *Require the interface to be explicitly async (`Promise<T>` return types only)*:
  rejected — would force a caller with a trivial synchronous `Map`-backed cache to wrap
  every call in `Promise.resolve(...)`, adding needless ceremony for the common case
  (User Story 3 explicitly calls out both sync and async backends as first-class).
- *Two separate interfaces (`SyncResultCache` / `AsyncResultCache`)*: rejected — adds
  API surface and a runtime type-detection step for no behavioral benefit, since `await`
  already unifies both cases.

## Decision 4: Failure isolation

**Decision**: `cache.get` and `cache.set` calls inside `withLifecycle` are each wrapped in
their own `try`/`catch` (mirroring the existing `safeInvoke` pattern used for lifecycle
hooks). A `get` failure is treated identically to a cache miss (falls through to running
the pipeline). A `set` failure after a successful fresh pipeline run does not affect the
result already computed — it is returned to the caller regardless.

**Rationale**: Directly satisfies FR-007 and the corresponding Edge Cases — a caller's
storage backend being temporarily unreachable must degrade to "no caching for this
request," never to "this request fails." This is the same isolation philosophy the
codebase already applies to lifecycle callbacks (`safeInvoke` in `grounded-call.ts`), so
the new code follows an established, already-tested pattern rather than inventing a new
one.

**Alternatives considered**:
- *Let a `get`/`set` failure propagate*: rejected — directly violates FR-007 and SC-005
  and would make adopting caching strictly riskier than not adopting it, undermining the
  entire opt-in value proposition.

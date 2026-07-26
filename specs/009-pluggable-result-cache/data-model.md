# Data Model: Pluggable Result Cache

No persisted data model or database entities are introduced — the cache backend itself
lives entirely outside the library (spec Assumptions). This document describes the
in-memory shapes the feature adds.

## ResultCache (config-level entity)

Caller-supplied object passed as `cache` on `GroundedCallConfig`. Represents the
external cache described in spec's "Cache" key entity.

| Field | Type | Notes |
|---|---|---|
| `get` | `(key: string) => unknown \| undefined \| Promise<unknown \| undefined>` | Looks up a previously stored result. `undefined` (or a resolved `undefined`) means "no entry" — treated as a cache miss. |
| `set` | `(key: string, value: unknown) => void \| Promise<void>` | Stores a result under `key`. Return value ignored. |

Constraints:
- Both methods are always invoked through `await`, so either sync or Promise-returning
  implementations work without adaptation (research.md Decision 3).
- The library never calls any method on `ResultCache` other than `get`/`set` (FR-002) —
  no delete, enumerate, or TTL/expiry hook exists on the contract.
- A thrown/rejected `get` or `set` is caught by the library and treated as "no cache for
  this operation" (research.md Decision 4) — it never surfaces to the caller as an error
  from `generate`/`extract`/`compose`.

## Cache Key (derived value)

A `string`, produced by `deriveCacheKey(operation, input)` (`src/core/result-cache.ts`).

Composition:
```
"<operation>:<sha256 hex digest of stable-stringified input>"
```

| Component | Source | Included because |
|---|---|---|
| `operation` | Literal per generator method, e.g. `"GroundedGenerator.generate"` | Prevents key collisions across different generator types even on identical serialized input |
| request content fields | The generator's own request object (e.g. `{context, question}` for `GroundedGenerator`, `{baseContent, context}` for `GroundedEnricher`, `{message}` for `GroundedExtractor`, `{instructions, context}` for `GroundedComposer`) | Directly determines the pipeline's input, and therefore its output (spec FR-003) |
| `identity`, `rules`, `tone` | This generator instance's config, if set | Appended to the system prompt (`buildSystemPrompt`), so they affect output (spec FR-003, issue text) |
| `model`, `temperature` | This generator instance's config | Directly affect model output determinism (constitution principle 6) |
| `fields`, `strict` | `GroundedExtractor` only, from its config | Define the extraction schema and strictness, which determine the shape/content of `data` in the result |

Excluded (do not affect output, so excluded from the key to avoid needless cache misses
or serialization failures): `client`, `apiKey`, `provider`, `providerOptions`,
`providerAdapter`, `langchainModel`, `maxContextTokens`, `fallbackValue`, `onCall`,
`onResult`, `onError`, `cache` itself.

State/validation:
- Deterministic: the same logical input always serializes to the same key (stable,
  recursively key-sorted stringification — research.md Decision 2).
- No state is retained by the library between calls; the key is computed fresh each call
  and is not stored anywhere except by the caller's own cache implementation.

## Cached Result

Not a new type — a cache hit returns the same `GroundedCallResult` /
`GroundedExtractionResult<Fields>` shape (`src/core/types.ts`,
`src/generators/grounded-extractor.ts`) the pipeline itself would have produced,
retrieved verbatim from `ResultCache.get`. No new fields are added to these result types
by this feature.

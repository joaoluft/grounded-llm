# Feature Specification: Pluggable Result Cache

**Feature Branch**: `10-pluggable-result-cache-to-prevent-redundant-duplicate-calls`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Pluggable result cache to prevent redundant duplicate calls (GitHub issue #10). Every call re-runs the full four-step pipeline (extract, judge, answer, explain) even for identical {context, question} pairs — this is 3-4x the token cost of a naive single-shot call by design, which is the tradeoff for reduced hallucination, but it means accidental duplicate calls (retries, double-submits, repeated questions in a chat) are expensive both in cost and latency with no mitigation today. Accept an optional cache interface at construction: { get(key), set(key, value) }, left unimplemented/no-op by default (BYO Redis, in-memory Map, etc). Define the cache key deterministically from the normalized input. Document that this is opt-in and the caller is responsible for cache invalidation policy."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skip redundant pipeline runs for identical requests (Priority: P1)

An application developer integrating the library into a chat or Q&A product wants to avoid paying the full multi-step pipeline cost when a user (or their own retry/double-submit logic) sends the exact same request twice. They configure the library instance with a cache of their choosing, and subsequent identical requests are served from that cache instead of re-running the pipeline.

**Why this priority**: This is the entire value of the feature — without it, there is no cost or latency savings, and the feature has no purpose. It is also independently shippable and testable in isolation.

**Independent Test**: Configure a library instance with a simple in-memory cache, issue the same request twice, and verify the second call returns the identical result without invoking the underlying model provider a second time.

**Acceptance Scenarios**:

1. **Given** a library instance configured with a cache, **When** a request is made for the first time, **Then** the full pipeline runs, the model provider is invoked, and the result is stored in the cache before being returned.
2. **Given** a library instance configured with a cache that already holds a result for a given request, **When** the identical request is made again, **Then** the cached result is returned, the pipeline does not run, and the model provider is not invoked.
3. **Given** a library instance configured with a cache, **When** two requests differ in any field that affects the output (e.g. different question, different context, different behavioral configuration), **Then** each is treated as distinct and the pipeline runs independently for each.

---

### User Story 2 - No behavior change when caching is not configured (Priority: P1)

A developer who does not need caching, or is upgrading from a previous version of the library, does not configure a cache. Their existing integration continues to work exactly as before, with every call running the full pipeline.

**Why this priority**: Caching must be strictly opt-in. Any change in default behavior would silently alter cost, latency, or correctness characteristics for every existing user of the library and would be a breaking change.

**Independent Test**: Run the existing test suite and any existing integration against the library without configuring a cache; confirm every call still executes the full pipeline and results are unaffected.

**Acceptance Scenarios**:

1. **Given** a library instance created without a cache configured, **When** any request is made, **Then** the full pipeline runs exactly as it did before this feature existed.
2. **Given** a library instance created without a cache configured, **When** the same request is made multiple times, **Then** the pipeline runs in full every time, with no caching side effects.

---

### User Story 3 - Bring your own cache backend (Priority: P2)

A developer wants their cache to be backed by a store appropriate to their deployment (in-process memory for a single instance, Redis or another shared store for a multi-instance deployment). They implement a small adapter around their chosen store and pass it in; the library does not require or bundle any particular storage technology.

**Why this priority**: Storage-agnosticism is what makes the feature usable across the range of deployments this library targets, but it is only meaningful once the core caching behavior (User Story 1) exists.

**Independent Test**: Provide two different cache implementations (e.g. a plain in-memory map and a stub that mimics a remote store with async access) against the same request sequence and confirm both integrate correctly and produce the same caching behavior.

**Acceptance Scenarios**:

1. **Given** a cache implementation whose lookup and storage operations are asynchronous, **When** it is configured on a library instance, **Then** the library correctly awaits those operations before deciding whether to run the pipeline.
2. **Given** a cache implementation whose lookup and storage operations are synchronous, **When** it is configured on a library instance, **Then** the library integrates with it without requiring changes to the implementation.

### Edge Cases

- What happens when the cache lookup fails or throws (e.g. the backing store is temporarily unreachable)? The request MUST still be served by falling back to running the pipeline; a caching failure must not surface as a request failure.
- What happens when the cache write fails or throws after a fresh result was computed? The freshly computed result MUST still be returned to the caller; only the caching step is affected.
- What happens when two requests are identical except for whitespace or field ordering in structured inputs? Key derivation must normalize such differences so they are treated as the same request (see FR-003).
- What happens when a cache entry is stale (e.g. the caller's underlying source data changed but the cache was not invalidated)? This is explicitly out of scope for the library — invalidation and freshness policy is the caller's responsibility (see FR-006 and Assumptions).
- What happens for requests that use a fallback response (e.g. the pipeline judged the context insufficient and returned a fallback) — are those cached too? Yes; a fallback result is a valid, deterministic result for that input and MUST be cached like any other result, so a repeated request for known-insufficient context also skips the pipeline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library MUST allow an optional cache to be configured when a generator instance is constructed. When no cache is configured, the generator MUST behave exactly as it does today (see User Story 2).
- **FR-002**: A configured cache MUST expose exactly two operations available to the library: retrieving a previously stored result for a given request, and storing a result for a given request. The library MUST NOT require any other capability (e.g. deletion, enumeration, expiry) from the cache.
- **FR-003**: The library MUST derive a lookup key for each request deterministically from the normalized request input, including every field that can affect the produced result (the request's content fields, such as context/question/base content/message/instructions depending on the generator, plus any per-instance behavioral configuration that influences output, such as identity, rules, and tone). Two requests with equivalent content and configuration MUST always produce the same key; two requests that differ in any output-affecting field MUST produce different keys.
- **FR-004**: When a configured cache holds a result for the derived key, the library MUST return that result without executing the pipeline or contacting the model provider.
- **FR-005**: When a configured cache does not hold a result for the derived key, the library MUST execute the pipeline as normal, then store the resulting result under that key before returning it to the caller.
- **FR-006**: The library MUST NOT implement or impose any cache invalidation, expiry, or eviction policy. Documentation MUST make clear that the caller owns this responsibility (e.g. by choosing a cache implementation with TTL or by clearing entries themselves).
- **FR-007**: If a cache operation (lookup or storage) fails, the library MUST NOT let that failure prevent a request from being served; the request MUST proceed as if no cache were configured for that operation (see Edge Cases).
- **FR-008**: The library MUST support cache implementations whose operations return their results asynchronously (e.g. backed by a network call), without requiring the caller to adapt a synchronous interface.
- **FR-009**: Existing structured logging/lifecycle hooks (onCall, onResult, onError) MUST continue to reflect the real outcome of a request regardless of whether that request was served from cache or from a fresh pipeline run, so callers relying on those hooks are not misled about token usage or cost.
- **FR-010**: The cache option MUST be documented, including its opt-in nature, the shape a caller must implement, what participates in key derivation, and that invalidation is the caller's responsibility.

### Key Entities

- **Cache**: A caller-supplied object representing a pluggable result store. Represents the contract between the library and an external storage mechanism chosen by the caller (in-memory, Redis, or otherwise). Not implemented by the library itself.
- **Cache Key**: A deterministic identifier derived from a request's normalized content and the output-affecting configuration of the generator instance that produced it. Used to look up and store cached results.
- **Cached Result**: The previously computed result for a given cache key, returned verbatim (including any fallback state) when a matching key is found, instead of re-running the pipeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a cache is configured, an identical repeated request completes without any call to the underlying model provider, eliminating that request's token cost and reducing its latency to a cache lookup.
- **SC-002**: When no cache is configured, request behavior, output, and latency profile are unchanged from before this feature existed, for 100% of existing requests.
- **SC-003**: A caller can integrate a custom cache backend (in-memory or remote) without modifying library internals, using only the documented cache contract.
- **SC-004**: Requests that differ in any field affecting the output are never incorrectly served a cached result from a different request (zero false-positive cache hits).
- **SC-005**: A transient failure in the caller's cache backend never causes a request that would otherwise have succeeded to fail.

## Assumptions

- The caller is responsible for choosing a cache backend appropriate to their deployment (single-process in-memory map, shared Redis, or otherwise); the library ships no default implementation.
- The caller is responsible for cache invalidation and freshness policy (TTL, manual eviction, versioning source data, etc.); the library only reads and writes entries, it does not expire them.
- "Identical request" means equivalent normalized content fields and output-affecting configuration for a given generator; internal-only fields that do not affect the pipeline's output (if any) do not need to participate in key derivation.
- This feature applies uniformly to all generator types in the library (single-turn Q&A style generation, content enrichment, extraction, and composition), since all of them run the same class of multi-step, provider-calling pipeline this feature is designed to short-circuit.
- Caching is per logical request/response pair; it does not cache partial pipeline state (e.g. only the extract step) — a cache hit always yields a complete result equivalent to what the full pipeline would have produced.

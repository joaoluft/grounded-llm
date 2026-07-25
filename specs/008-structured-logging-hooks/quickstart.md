# Quickstart: Structured Logging Hooks

**Feature**: 008-structured-logging-hooks | **Date**: 2026-07-25

End-to-end validation guide. No implementation code — only the steps and scenarios to
run against the implementation produced by `/speckit-tasks` + implementation.

## Prerequisites

- Node.js 20+, dependencies already installed (no new dependency for this feature).
- Mocked model client (same mocking strategy already used by
  `tests/unit/generators/*.test.ts`) — no real API calls.

## Setup

```bash
npm install
npm run build
npm test
```

## Validation scenarios

### Scenario 1 — Observe a successful call with no call-site changes (US1)

1. Construct any grounded component (e.g. `GroundedGenerator`) with `onCall` and
   `onResult` callbacks configured, recording their invocations (e.g. push into an
   array).
2. Call it once with valid input, using a mocked model client that returns a
   successful response.
3. **Expected**: `onCall` was invoked exactly once before the model was reached;
   `onResult` was invoked exactly once after, with `durationMs >= 0` and `usedFallback`
   matching the actual result; both events share the same `callId`; `onError` was never
   invoked; the value returned to the caller is identical to what it would be without
   any callbacks configured.

### Scenario 2 — No callbacks configured is a true no-op (US1, FR-009)

1. Construct the same component with no `onCall`/`onResult`/`onError` configured.
2. Repeat the same call as Scenario 1.
3. **Expected**: the returned result is identical to Scenario 1's — no observable
   difference in behavior, timing-sensitive fields aside.

### Scenario 3 — Distinguish failure types (US2)

1. Construct a component with an `onError` callback configured, recording each
   invocation's `errorType`.
2. Force, in separate calls, each of: a model-unavailable failure (mocked client
   throws/rejects a transport-level error), an invalid-output failure (mocked client
   returns output that fails schema validation, or a refusal), and a context-too-large
   failure (call with a prompt exceeding `maxContextTokens`).
3. **Expected**: each call produces exactly one `onError` invocation, with a distinct
   `errorType` — `'model-unavailable'`, `'invalid-output'`, and `'context-too-large'`
   respectively — and `onResult` is never invoked for these calls.

### Scenario 4 — `onCall` always precedes its terminal callback (US2)

1. Reuse the setups from Scenarios 1 and 3, recording invocation order across
   `onCall`/`onResult`/`onError`.
2. **Expected**: for every call, `onCall` fires before the matching `onResult` or
   `onError`, and both carry the same `callId`.

### Scenario 5 — A throwing callback cannot affect the call (US3)

1. Construct a component with `onCall`, `onResult`, and `onError` callbacks that each
   throw synchronously when invoked.
2. Make one successful call and one failing call (as in Scenario 3).
3. **Expected**: both calls complete exactly as they would with no callbacks configured
   — the successful call returns its normal result, the failing call throws its normal
   (library) error — and no exception from a callback ever reaches the caller.

### Scenario 6 — Fallback usage is reported, not treated as an error (Edge case)

1. Construct a `GroundedGenerator`/`GroundedEnricher`/`GroundedExtractor` with a
   `fallbackValue` configured and an `onResult` callback.
2. Call it with input that triggers the fallback (e.g. insufficient context).
3. **Expected**: `onResult` fires (not `onError`) with `usedFallback: true`.

### Scenario 7 — Consistent behavior across backend modes (FR-008)

1. Repeat Scenario 1 with the same component constructed using `langchainModel` instead
   of the native provider path (mocked LangChain chat model returning an equivalent
   successful response).
2. **Expected**: `onCall`/`onResult` fire with the same payload shape and semantics as
   in standalone mode.

### Scenario 8 — README example works as documented (SC-005)

1. Follow the new README "Structured logging hooks" section's console/Prometheus-style
   example verbatim in a small script or test.
2. **Expected**: it runs without modification beyond supplying real credentials, and
   produces one log/metric line per call, matching the section's description.

### Scenario 9 — No regression in existing components (FR-009, spec Assumptions)

1. Run the already-existing test suite for `GroundedGenerator`, `GroundedEnricher`,
   `GroundedExtractor`, `GroundedComposer`.
2. **Expected**: 100% of existing tests continue passing without any expectation change.

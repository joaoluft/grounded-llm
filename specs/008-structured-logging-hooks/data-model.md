# Phase 1 Data Model: Structured Logging Hooks

## `LifecycleErrorType` (new, `src/core/lifecycle-callbacks.ts`)

```ts
type LifecycleErrorType =
  | 'model-unavailable'
  | 'invalid-output'
  | 'context-too-large'
  | 'provider-error'
  | 'unknown';
```

See research.md Decision 3 for the mapping from thrown error class to this type.

## `CallEvent` (new — payload delivered to `onCall`)

| Field | Type | Description |
|---|---|---|
| `callId` | `string` | Correlation id unique to this call attempt (`randomUUID()`), shared with the matching `ResultEvent`/`ErrorEvent` (FR-002). |
| `operation` | `string` | `"<ComponentName>.<methodName>"` label identifying which component and method was invoked (research.md Decision 5), e.g. `"GroundedGenerator.generate"`. |

## `ResultEvent` (new — payload delivered to `onResult`)

| Field | Type | Description |
|---|---|---|
| `callId` | `string` | Same value as the `CallEvent` for this attempt (FR-003). |
| `operation` | `string` | Same value as the `CallEvent` for this attempt. |
| `durationMs` | `number` | Elapsed wall-clock time from just before the call started to the point the result was known (FR-003). |
| `usedFallback` | `boolean` | Copied from the operation's own result (`GroundedCallResult.usedFallback` / `GroundedExtractionResult.usedFallback`). Always `false` for `GroundedComposer`, which never falls back. |

## `ErrorEvent` (new — payload delivered to `onError`)

| Field | Type | Description |
|---|---|---|
| `callId` | `string` | Same value as the `CallEvent` for this attempt (FR-004). |
| `operation` | `string` | Same value as the `CallEvent` for this attempt. |
| `durationMs` | `number` | Elapsed wall-clock time from just before the call started to the point the failure was known (FR-004). |
| `errorType` | `LifecycleErrorType` | Classification of the failure (research.md Decision 3). |
| `error` | `unknown` | The original thrown value, untouched (research.md Decision 6). In practice always an `Error` subclass thrown by this library's own code paths. |

None of the three payloads includes raw call content (context, question, rules, tone,
extracted facts, or final answer text) — see spec FR-005 and research.md Decision 6.

## `GroundedCallConfig` additions (`src/core/types.ts`, modified)

| Field | Type | Description |
|---|---|---|
| `onCall` | `(event: CallEvent) => void` (optional) | Called once per call attempt, before the model is reached (FR-002). |
| `onResult` | `(event: ResultEvent) => void` (optional) | Called once per call attempt, on success (FR-003). |
| `onError` | `(event: ErrorEvent) => void` (optional) | Called once per call attempt, on failure (FR-004). |

Each is independently optional (FR-010); omitting all three reproduces today's behavior
exactly (FR-009).

## `GroundedCall.withLifecycle()` (new protected method, `src/core/grounded-call.ts`)

Not a public type, but the core behavioral contract of this feature:

```ts
protected async withLifecycle<T extends { usedFallback: boolean }>(
  operation: string,
  fn: () => Promise<T>
): Promise<T>
```

Behavior:
1. Generate `callId = randomUUID()`.
2. Invoke `onCall?.({ callId, operation })`, catching and discarding any exception it
   throws (FR-007).
3. Record `start`.
4. Run `fn()`.
   - On success: compute `durationMs`, invoke
     `onResult?.({ callId, operation, durationMs, usedFallback: result.usedFallback })`
     (catching/discarding any exception it throws), then return `result` unchanged.
   - On failure: compute `durationMs`, classify the error via
     `classifyOperationalError(error)`, invoke
     `onError?.({ callId, operation, durationMs, errorType, error })` (catching/discarding
     any exception it throws), then re-throw the *original* error unchanged.

This single wrapper is what each of the four generators' public entry points delegates
through, so behavior (including in `langchainModel` mode, since `withLifecycle` sits
above `callModel` and is backend-agnostic) is uniform across all of them (FR-008).

## No state transitions

Callbacks are stateless, fire-and-forget function invocations tied to a single call
attempt — there is no persisted entity and no state machine introduced by this feature.

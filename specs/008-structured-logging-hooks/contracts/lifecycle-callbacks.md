# Contract: Lifecycle Callbacks (Public API)

**Feature**: 008-structured-logging-hooks | **Date**: 2026-07-25

## Construction

Three new independently optional fields on `GroundedCallConfig` (shared by
`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, `GroundedComposer`):

```ts
onCall?: (event: CallEvent) => void;
onResult?: (event: ResultEvent) => void;
onError?: (event: ErrorEvent) => void;
```

All existing fields (`client`, `apiKey`, `provider`, `model`, `langchainModel`,
`fallbackValue`, `temperature`, `maxContextTokens`, `identity`, `rules`, `tone`) are
unaffected — see data-model.md for the new types.

## Behavioral contract, per call attempt

1. `onCall`, if configured, MUST fire exactly once, before the call reaches the model,
   for every invocation of `generate()`/`extract()`/`compose()`.
2. Exactly one of `onResult` or `onError` MUST fire per call attempt once `onCall` has
   fired — never both, never neither.
3. `onResult` fires on success (including when a fallback value is used — a fallback is
   still a successful outcome, never routed to `onError`).
4. `onError` fires on failure, including:
   - `ContextTooLargeError` (prompt exceeds the configured limit),
   - `ModelUnavailableError` (technical failure reaching the model),
   - `InvalidModelOutputError` (model output fails schema validation or is refused),
   - `ProviderError` (provider selection/auth/unsupported-capability failure),
   - any other error thrown before the model is reached (classified `'unknown'`).
5. A callback that throws synchronously MUST NOT propagate — the call's own result or
   error (the value/exception the *caller* of `generate()`/`extract()`/`compose()` sees)
   MUST be byte-for-byte identical to what it would be with no callbacks configured.
6. No callback is ever awaited — a callback returning a Promise does not delay or
   otherwise affect the call.
7. Behavior is identical whether the component is constructed in standalone (native
   provider) mode or with `langchainModel` — same events, same payload shape, same
   ordering guarantees.
8. Payloads never include raw call content (`context`, `question`/`message`,
   `instructions`, `rules`, `identity`, `tone`, extracted facts, or final answer/data
   text) — only the metadata fields listed in data-model.md.
9. With no callbacks configured (the default), there is zero observable behavior
   difference from the component's behavior before this feature existed.

## Out of scope for this contract

- Any change to `GroundedCallResult`, `GroundedExtractionResult`, or any structured
  output schema — this feature adds no field to any of them.
- Batching, sampling, log-level filtering, or any bundled logging/metrics integration —
  the callbacks are a raw instrumentation seam; the developer supplies their own
  logging/metrics client inside the callback body (see quickstart.md for a worked
  example).
- Async/awaited callbacks, or any mechanism for a callback to influence the call's
  outcome (e.g. retry, short-circuit, or transform the result) — deliberately excluded
  per the issue's "synchronous/fire-and-forget" requirement.
- Changing the four existing generators' own request/response/validation behavior —
  this feature only adds an observation layer around their existing entry points.

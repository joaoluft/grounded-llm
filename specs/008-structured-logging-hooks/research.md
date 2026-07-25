# Phase 0 Research: Structured Logging Hooks

## Decision 1: Wrap the whole public entry-point method, not just `callModel`

**Decision**: Dispatch `onCall`/`onResult`/`onError` around each component's entire
public method body (`GroundedGenerator.generate`, `GroundedEnricher.generate`,
`GroundedExtractor.extract`, `GroundedComposer.compose`) via a new protected
`withLifecycle()` helper on `GroundedCall`, rather than instrumenting only the shared
`callModel()` helper.

**Rationale**: `usedFallback` (required by spec FR-003) is only known at the
component/operation level — `GroundedGenerator.generate()` decides whether to use the
fallback *after* `callModel()` returns and the structured output is validated. `callModel`
itself has no notion of fallback. Wrapping the whole method also matches the issue's own
framing ("no way to observe calls ... without wrapping every `.generate()`/`.extract()`/
`.compose()` call manually") — the callbacks effectively *are* that wrapper, applied once
at the library level instead of per call site. It also naturally covers
`ContextTooLargeError`, which is thrown by `assertContextWithinLimit()` *before*
`callModel()` is ever invoked (spec US2 acceptance scenario 3 requires this to reach
`onError`).

**Alternatives considered**:
- *Instrument only `callModel()`*: rejected — cannot report `usedFallback`, and would
  miss `ContextTooLargeError` (thrown earlier) and any pre-model validation errors.
- *Instrument at both `callModel()` and the public method*: rejected as needless
  duplication — a single wrap point at the public method is sufficient and simpler, and
  keeps `callModel()`'s existing error-translation behavior untouched.

## Decision 2: Correlation id generation

**Decision**: Use `randomUUID()` from Node's built-in `node:crypto` module to generate a
per-call correlation id, one per `withLifecycle()` invocation.

**Rationale**: Zero new dependency, available unconditionally on Node.js 20+ (the
project's stated target platform), and works identically under both the ESM and CJS
builds produced by `tsup` (a Node builtin import, not a global that some bundler configs
might strip). `crypto.randomUUID()` as a browser-style global was considered but
`node:crypto`'s named export is more explicit and matches how the codebase already
imports Node/library APIs elsewhere.

**Alternatives considered**:
- *`globalThis.crypto.randomUUID()`*: works on Node 20 but relies on a global that is
  less obviously guaranteed across bundling/runtime edge cases than an explicit import.
- *A new `uuid` dependency*: rejected — unnecessary; `node:crypto` already covers the
  need with no added package weight (this feature adds no new dependency, matching
  Constitution principle 9's spirit of minimal added complexity).
- *Monotonic counter instead of a UUID*: rejected — a per-instance counter would not be
  unique across separate component instances or process restarts, weakening the
  correlation guarantee (spec clarification: "every event for the same call attempt
  carries the same unique id").

## Decision 3: Error classification

**Decision**: Introduce a `LifecycleErrorType` union —
`'model-unavailable' | 'invalid-output' | 'context-too-large' | 'provider-error' |
'unknown'` — and a `classifyOperationalError(error: unknown): LifecycleErrorType`
function in the new `src/core/lifecycle-callbacks.ts`, mapping:

| Error thrown | `LifecycleErrorType` |
|---|---|
| `ModelUnavailableError` | `'model-unavailable'` |
| `InvalidModelOutputError` | `'invalid-output'` |
| `ContextTooLargeError` | `'context-too-large'` |
| `ProviderError` | `'provider-error'` |
| anything else (e.g. a plain `Error` from an earlier synchronous input-validation check, such as an empty `question`/`instructions`) | `'unknown'` |

**Rationale**: Spec FR-004 requires distinguishing "at minimum" the four named
operational categories — the four typed error classes in `src/core/errors.ts` map
directly onto them. `'unknown'` is added as a catch-all so `withLifecycle()` can safely
wrap the *entire* method body (Decision 1) — including early synchronous validation that
throws a plain `Error` — without ever failing to classify an error. This doesn't
contradict FR-004 ("at minimum" permits additional categories) and keeps `onError`
total: every failure gets *some* classification.

**Alternatives considered**:
- *Only classify the four named types, let anything else propagate unclassified
  (no `onError` call)*: rejected — would violate spec FR-006 ("exactly one of `onResult`
  or `onError` MUST fire ... whenever `onCall` has fired"), since early validation errors
  would fire `onCall` but never a terminal callback.
- *Expose `ProviderError.category` (selection/auth/unavailable/output-invalid/
  unsupported-capability) as its own top-level `LifecycleErrorType` values instead of a
  single `'provider-error'`*: rejected for v1 — adds surface area the spec doesn't ask
  for; the underlying `ProviderError` instance (with its own `.category`) is still passed
  through in the error event for a developer who needs that detail (see data-model.md).

## Decision 4: Config shape — flat fields, not a nested `callbacks` object

**Decision**: Add `onCall?`, `onResult?`, `onError?` directly on `GroundedCallConfig`,
each independently optional, rather than a single `callbacks?: { onCall?, ... }` nested
object.

**Rationale**: Matches the issue's literal phrasing ("Accept optional lifecycle callbacks
at construction: `onCall` ... `onResult` ... `onError`") and the existing flat style of
`GroundedCallConfig` (`identity`, `rules`, `tone` are all top-level optional fields, not
grouped under a `personalization` object). Keeps spec FR-010 (each callback independently
configurable) trivially true — no partial-object ergonomics to reason about.

**Alternatives considered**:
- *Nested `callbacks` object*: rejected — no precedent in this config's existing style,
  and adds a level of indirection with no behavioral benefit for exactly three fields.

## Decision 5: Operation label

**Decision**: Each event's `operation` field is a string of the form
`"<ComponentName>.<methodName>"` (e.g. `"GroundedGenerator.generate"`,
`"GroundedEnricher.generate"`, `"GroundedExtractor.extract"`,
`"GroundedComposer.compose"`), passed as a literal by each subclass when calling
`withLifecycle()`.

**Rationale**: `GroundedGenerator` and `GroundedEnricher` both expose a method literally
named `generate()` — the method name alone is ambiguous for a developer aggregating logs
across component types. Prefixing with the component name disambiguates without
requiring a new enum that would need to be extended for every future generator.

**Alternatives considered**:
- *Method name only (`"generate"`, `"extract"`, `"compose"`)*: rejected — ambiguous
  between `GroundedGenerator` and `GroundedEnricher`.
- *A closed enum of operation identifiers*: rejected — adds a maintenance point (must be
  extended for every new generator) for no behavioral benefit over a plain string.

## Decision 6: What the error event carries alongside the classification

**Decision**: `ErrorEvent` carries both the classified `errorType: LifecycleErrorType`
and the original thrown `error: unknown` (untouched, not stringified or redacted).

**Rationale**: The spec's "metadata only, no raw call content" clarification (FR-005)
is about call *content* — context, question, rules, extracted facts, final answer — not
about technical failure diagnostics. Error messages produced by this library (e.g.
`ModelUnavailableError`'s message, which wraps a network/SDK error) do not contain
developer-supplied call content, so passing the error through is safe and lets a
developer log its message/stack or inspect a `ProviderError`'s `.category`/
`.remediationHint` without the library needing to duplicate that detail into a bespoke
payload shape.

**Alternatives considered**:
- *Only pass `error.message` (string)*: rejected — loses the error's type/`cause` chain
  and any subtype-specific fields (e.g. `ProviderError.remediationHint`), which are
  useful for the exact alerting/triage use case spec US2 describes.

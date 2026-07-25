# Feature Specification: Structured Logging Hooks

**Feature Branch**: `008-structured-logging-hooks`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Add structured logging hooks (onCall, onResult, onError) as optional lifecycle callbacks at construction time for grounded-llm's core client(s). Source: https://github.com/joaoluft/grounded-llm/issues/8. There's currently no way to observe calls in production without wrapping every .generate()/.extract()/.compose() call manually. LangSmith tracing is covered via langchainModel, but standalone mode has nothing. Accept optional lifecycle callbacks at construction: onCall (before the model request), onResult (after success, with timing + usedFallback), onError (with the specific operational error type). Keep these synchronous/fire-and-forget — they should never block or alter the actual call result. Callbacks must fire with correct payloads in both standalone and langchainModel mode. README section showing a basic Prometheus/console logging example."

## Clarifications

### Session 2026-07-25

- Q: Callback payloads (onCall/onResult/onError) — should they include the raw call content (context/question/rules/final answer), or only metadata (operation name, timing, fallback flag, error classification)? → A: Metadata only — no raw context/question/answer text in payloads, to avoid leaking sensitive/PII data into logs or metrics backends by default.
- Q: Should each call carry a correlation id so a developer can pair onCall with its matching onResult/onError, especially under concurrent calls? → A: Yes — every event for the same call attempt carries the same unique call id.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Observe every call without touching call sites (Priority: P1)

A developer runs a grounded component (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, or `GroundedComposer`) in production and wants basic observability — knowing when a call started, how long it took, and whether it succeeded — without wrapping every `.generate()`/`.extract()`/`.compose()` call site with manual instrumentation code.

**Why this priority**: This is the problem the issue exists to solve. Without it, every call site needs its own ad-hoc wrapping, which is exactly the friction the feature removes.

**Independent Test**: Can be tested by configuring `onCall` and `onResult` callbacks once at construction, invoking the component, and verifying both callbacks fire with the expected payload — without any change to the call itself.

**Acceptance Scenarios**:

1. **Given** a component constructed with `onCall` and `onResult` callbacks configured, **When** a call is made and completes successfully, **Then** `onCall` fires once before the model request and `onResult` fires once after completion, reporting elapsed time and whether a fallback value was used.
2. **Given** a component constructed without any callbacks, **When** a call is made, **Then** behavior is identical to before this feature existed — no callback-related side effects occur.

---

### User Story 2 - Distinguish failure types for alerting (Priority: P1)

A developer wants to route or alert on failures differently depending on their cause — e.g. treat a model-unavailable error (retry-worthy) differently from an invalid-model-output error (not retry-worthy) or a context-too-large error (a caller bug). Today, catching a call site's exception only gives a generic failure; there is no low-friction way to classify it consistently across every call in the codebase.

**Why this priority**: Distinguishing failure types is what makes the observability actionable (e.g., paging vs. logging vs. ignoring); without it, `onError` would report only "something failed," which is not enough for production use.

**Independent Test**: Can be tested by forcing each known failure mode (model unavailable, invalid/refused model output, context too large, provider-level failure) and verifying `onError` reports a distinct, identifiable classification for each, plus elapsed time.

**Acceptance Scenarios**:

1. **Given** a component constructed with an `onError` callback, **When** a call fails because the model backend is unavailable, **Then** `onError` fires with a classification identifying it as a model-unavailable failure.
2. **Given** the same setup, **When** a call fails because the model output is invalid or refused, **Then** `onError` fires with a classification identifying it as an invalid-output failure, distinguishable from the model-unavailable case.
3. **Given** the same setup, **When** a call fails because the estimated prompt size exceeds the configured context limit, **Then** `onError` fires with a classification identifying it as a context-too-large failure.
4. **Given** any failed call, **When** `onError` fires, **Then** `onCall` has already fired for that same call and `onResult` does NOT fire for it.

---

### User Story 3 - Callbacks never put the call at risk (Priority: P2)

A developer wires up logging/metrics callbacks that could themselves misbehave (throw, run slowly, or have a bug) — for example, a Prometheus client that throws when a metric label is malformed, or a console logger touching a closed stream. The developer needs certainty that a broken callback cannot break, delay, or silently alter the actual call result.

**Why this priority**: Without this guarantee, adding observability would introduce a new source of production incidents, undermining the entire purpose of the feature. It's a safety property that must hold for US1/US2 to be trustworthy, so it's rated just below them.

**Independent Test**: Can be tested by configuring a callback that throws synchronously, making a call, and verifying the call still returns its normal result (or throws its normal error) unaffected, with no exception from the callback surfacing to the caller.

**Acceptance Scenarios**:

1. **Given** a component constructed with an `onCall`, `onResult`, or `onError` callback that throws when invoked, **When** a call is made, **Then** the call still completes with its normal result (or normal error), and the exception thrown by the callback does not propagate to the caller.
2. **Given** a component constructed with callbacks, **When** a call is made, **Then** the value returned to the caller (or the error thrown to the caller) is identical to what it would be with no callbacks configured at all.

---

### Edge Cases

- What happens when only one of the three callbacks is configured (e.g. only `onError`)? Only that callback fires when its condition is met; the other lifecycle points are simply not observed.
- What happens when a callback is slow? It MUST NOT be awaited or otherwise block progress of the call — the call proceeds and returns on its own timing.
- What happens when a fallback value is used instead of a generated result? This is still a successful outcome: `onResult` fires (not `onError`), with the fallback usage reported.
- What happens for `GroundedComposer`, which never uses a fallback? `onResult` still fires on every successful call, always reporting no fallback used.
- What happens on concurrent/parallel calls from the same component instance? Each call's callback invocations carry only that call's own data, tagged with that call's own correlation id — no mixing of payloads across concurrent calls, and no ambiguity about which `onResult`/`onError` belongs to which `onCall`.
- What happens with sensitive call content (context, question, rules, final answer)? It is never included in callback payloads — only metadata (operation name, correlation id, timing, fallback flag, error classification) is reported, so wiring up logging/metrics cannot leak call content by default.
- What happens in `langchainModel` mode? The same callbacks fire with the same payload shape as in standalone mode; the backend in use is not something the developer needs to branch on.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept, at construction of each grounded component (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, `GroundedComposer`), three independent, optional lifecycle callbacks: `onCall`, `onResult`, and `onError`.
- **FR-002**: `onCall` MUST fire once, before the underlying model request is made, for every call attempt, and MUST report a correlation id unique to that call attempt.
- **FR-003**: `onResult` MUST fire once, after a call completes successfully, reporting at minimum: the same correlation id reported to `onCall` for that attempt, the elapsed time of the call, and whether a fallback value was used in place of a generated result.
- **FR-004**: `onError` MUST fire once, when a call fails, reporting at minimum: the same correlation id reported to `onCall` for that attempt, the elapsed time of the call, and a specific classification of the operational failure — distinguishing, at minimum: model-unavailable, invalid/refused model output, context-too-large, and provider-level failures (selection, auth, unsupported capability).
- **FR-005**: Callback payloads MUST NOT include raw call content (e.g. context, question, rules, extracted facts, or final answer text) — only metadata (correlation id, operation name, timing, fallback flag, error classification) is reported, so that wiring up logging/metrics cannot leak call content by default.
- **FR-006**: For any single call attempt, exactly one of `onResult` or `onError` MUST fire, never both and never neither, whenever `onCall` has fired for that attempt.
- **FR-007**: Callbacks MUST NOT block, delay, or alter the outcome of the underlying call — an exception thrown synchronously by any callback MUST NOT propagate to the caller, and MUST NOT change the value or error the caller ultimately receives.
- **FR-008**: Callbacks MUST fire with equivalent payloads regardless of which backend mode handles the call — native provider (standalone) or a developer-supplied `langchainModel`.
- **FR-009**: When no callbacks are configured, the system MUST behave exactly as it did before this feature — fully backward compatible, opt-in only.
- **FR-010**: Each of the three callbacks MUST be independently configurable — a developer can supply any subset of `onCall`/`onResult`/`onError` without being required to supply the others.
- **FR-011**: Concurrent or overlapping calls from the same component instance MUST each produce their own independent callback invocations, tagged with their own correlation id, with no payload data crossing between calls.
- **FR-012**: The project README MUST document these callbacks with at least one worked example showing basic console-based or Prometheus-style metrics logging.

### Key Entities

- **Lifecycle callbacks (construction config)**: The optional `onCall`, `onResult`, and `onError` functions a developer may supply when constructing a grounded component; each configured independently and invoked automatically by the library.
- **Call event**: The signal that a call attempt is about to reach the model, delivered to `onCall`, carrying a correlation id unique to that attempt.
- **Result event**: The signal that a call attempt succeeded, delivered to `onResult`, carrying the same correlation id, elapsed time, and fallback-usage status.
- **Error event**: The signal that a call attempt failed, delivered to `onError`, carrying the same correlation id, elapsed time, and a specific operational failure classification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can add production observability (logging or metrics) covering every call of a component by configuring callbacks once at construction, without editing any existing call site.
- **SC-002**: In 100% of call attempts, exactly one terminal callback (`onResult` or `onError`) fires, and it accurately matches the call's real outcome.
- **SC-003**: A callback that throws or runs slowly never changes the result a caller receives, and never measurably delays it beyond the callback's own execution time being isolated from the call's critical path.
- **SC-004**: Given only the classification reported to `onError`, a developer can distinguish model-unavailable failures from invalid-output, context-too-large, and provider-level failures, without inspecting library internals.
- **SC-005**: A developer unfamiliar with the feature can follow the README example and get console or Prometheus-style logging working in a few minutes.

## Assumptions

- Callbacks are synchronous, fire-and-forget functions; the library does not await or otherwise depend on any value they return, matching the issue's "synchronous/fire-and-forget" requirement.
- "Fallback used" reporting in `onResult` is meaningful for `GroundedGenerator`, `GroundedEnricher`, and `GroundedExtractor` (which support a configurable fallback); for `GroundedComposer`, which never falls back, this is always reported as false.
- Elapsed time is measured for the full duration of a call attempt (from just before the model request to the point the result or error is known), not the caller's own pre/post-processing around the call.
- This feature is a minimal instrumentation seam — it does not include batching, sampling, log-level configuration, or a bundled metrics/logging integration. Developers plug their own tooling (e.g. Prometheus client, console, structured logger) into the callbacks themselves.
- Applies uniformly to all four existing grounded components, since they all share the same underlying call infrastructure.

# Feature Specification: Token Usage & Cost Metadata

**Feature Branch**: `6-add-token-usage-cost-metadata-to-groundedresult`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description: "Add token usage / cost metadata to GroundedResult (issue #6). Surface `usage` (prompt/completion/total tokens) on result object when available from underlying client. Document that field may be undefined in langchainModel mode if wrapped chat model doesn't expose usage. Acceptance: result.usage present and correct in standalone mode; README example showing how to log/aggregate usage across calls."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read token usage after a standalone call (Priority: P1)

A developer running the library in standalone mode (own API key, no LangChain model injected) calls a generator (generate/enrich/extract/compose) and wants to know how many tokens the call consumed, so they can track cost and enforce budgets in production pipelines.

**Why this priority**: This is the core value of the feature — the whole pitch is production reliability, and token usage is the primary cost signal. Without it, teams have no visibility into spend per call.

**Independent Test**: Call any generator in standalone mode against a real or mocked provider response that includes usage data, and confirm the returned result carries a `usage` object with prompt/completion/total token counts matching the provider's reported values.

**Acceptance Scenarios**:

1. **Given** a standalone-mode call to a provider that reports usage (OpenAI, Anthropic, or Google), **When** the call completes successfully, **Then** the returned result includes a `usage` field with correct prompt, completion, and total token counts.
2. **Given** a standalone-mode call that falls back (e.g., due to a retry/fallback path), **When** the fallback result is returned, **Then** the `usage` field reflects the call(s) actually made, or is absent if no usage data was available from those calls.

---

### User Story 2 - Understand usage availability in LangChain mode (Priority: P2)

A developer using `langchainModel` mode (wrapping their own LangChain chat model) wants to know whether they can rely on `usage` being present, so they don't write code that breaks when it's missing.

**Why this priority**: Without this, developers waste time debugging why `usage` is sometimes `undefined`, or file bug reports for expected behavior.

**Independent Test**: Read the documented behavior and confirm that a call made through `langchainModel` mode never throws or produces incorrect data because `usage` is unavailable — it is simply absent.

**Acceptance Scenarios**:

1. **Given** a `langchainModel`-mode call where the wrapped chat model does not expose usage metadata, **When** the call completes, **Then** the result's `usage` field is `undefined` and no error occurs.
2. **Given** the README, **When** a developer reads the token usage section, **Then** they find an explicit statement that `usage` may be `undefined` in `langchainModel` mode.

---

### User Story 3 - Aggregate usage across multiple calls (Priority: P3)

A developer wants to log and sum token usage across many calls (e.g., a batch pipeline) to compute total cost for a run.

**Why this priority**: Nice-to-have convenience on top of the core capability (P1) — the raw per-call field already unlocks this, but a documented pattern saves every consumer from re-deriving it.

**Independent Test**: Follow the README example to accumulate `usage` across several calls and confirm the running totals match the sum of individual per-call values.

**Acceptance Scenarios**:

1. **Given** the README usage-aggregation example, **When** a developer follows it across N calls, **Then** the aggregated prompt/completion/total token counts equal the sum of each call's `usage` values (treating missing `usage` as zero contribution).

---

### Edge Cases

- What happens when the underlying provider response omits usage entirely (e.g., a provider outage returns a partial payload)? → `usage` MUST be absent (`undefined`), never a fabricated or zeroed object.
- What happens when only some of prompt/completion/total counts are available from the provider? → Only the fields actually reported are populated; the rest are omitted rather than guessed.
- How does aggregation behave when some calls in a batch have `usage` and others don't? → The documented aggregation pattern MUST treat missing `usage` as contributing zero, not as an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every generator (GroundedGenerator, GroundedEnricher, GroundedExtractor, GroundedComposer) MUST include a `usage` field on its returned result object, containing prompt token count, completion token count, and total token count, when this data is available from the underlying provider call.
- **FR-002**: In standalone mode (direct provider adapters — OpenAI, Anthropic, Google), `usage` MUST be populated correctly from the provider's own reported token counts.
- **FR-003**: In `langchainModel` mode, `usage` MUST be `undefined` when the wrapped chat model does not expose usage metadata, and MUST NOT cause an error or incorrect fallback value.
- **FR-004**: The `usage` field MUST be optional/absent rather than present-with-zero-values whenever the underlying data is not available, so consumers can distinguish "unknown" from "zero tokens used."
- **FR-005**: Project documentation (README, English and Português sections) MUST describe the `usage` field, explicitly note its potential absence in `langchainModel` mode, and include a worked example of logging and aggregating usage across multiple calls.

### Key Entities

- **Usage**: Token accounting for a single call — prompt token count, completion token count, total token count. Attached to a generator's result when available.
- **Result**: The value returned by a generator call (GroundedGenerator/Enricher/Extractor/Composer), already carrying the answer/data plus fallback and reasoning metadata; extended to optionally carry **Usage**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standalone-mode calls to a provider that reports usage return a result with correct, matching token counts.
- **SC-002**: 0 calls in `langchainModel` mode throw an error or return incorrect data due to the presence or absence of the `usage` field.
- **SC-003**: A developer can implement cross-call usage aggregation by following the README example without needing to read library source code.

## Assumptions

- "GroundedResult" in the issue title refers to the family of result objects returned by the library's generators (`GroundedCallResult` and its per-generator siblings), not a single literally-named type — the feature applies to all of them uniformly.
- Only standalone-mode providers (OpenAI, Anthropic, Google) are required to populate `usage` correctly; extracting usage from LangChain's `withStructuredOutput` raw response is out of scope for this feature, since the issue's acceptance criteria only require correctness in standalone mode and documented absence in `langchainModel` mode.
- Forwarding `usage` into the existing structured-logging lifecycle hooks (`onCall`/`onResult`/`onError`, added in issue #8) is out of scope — the issue only asks for the field on the result object and a README example. This can be a natural follow-up if requested.
- "Cost" in the issue title is addressed via token counts only; computing a monetary cost estimate (which would require provider pricing tables kept in sync) is out of scope.

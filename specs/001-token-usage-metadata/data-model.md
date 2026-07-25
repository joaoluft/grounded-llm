# Phase 1 Data Model: Token Usage & Cost Metadata

## Usage

Token accounting for a single underlying model call. Already exists as `ProviderUsage` (`src/providers/types.ts:19-23`) — reused as-is, not redefined.

| Field | Type | Required | Notes |
|---|---|---|---|
| `promptTokens` | `number` | optional | Tokens in the input/prompt. Omitted if provider doesn't report it. |
| `completionTokens` | `number` | optional | Tokens in the generated output. Omitted if provider doesn't report it. |
| `totalTokens` | `number` | optional | Provider-reported total, or sum of the two above if the provider only reports total. |

**Validation rules**: Never populate a field with a fabricated `0` when the provider didn't report it — absence means "unknown," not "zero" (per spec FR-004 / Edge Cases).

## Result types extended with `usage`

Each of the following gains an optional `usage?: ProviderUsage` field. No existing field is renamed or removed — purely additive.

| Type | File | Existing fields (unchanged) |
|---|---|---|
| `GroundedCallResult` | `src/core/types.ts:82-87` | `finalAnswer`, `usedFallback`, `extractedFacts`, `reasoning` |
| `GroundedExtractionResult<Fields>` | `src/generators/grounded-extractor.ts:26-30` | `data`, `usedFallback`, `reasoning` |
| Composer's inline result type | `src/generators/grounded-composer.ts:76-81` | same shape as `GroundedCallResult` |

**State/lifecycle**: `usage` is set once, at the point each generator's `do*` method builds its return value (success or fallback path), from whatever `callModel` returned for that call. It is never mutated afterward.

## Out of scope for this data model

- `ResultEvent` (`src/core/lifecycle-callbacks.ts:19-24`, the `onResult` hook payload) — not extended in this feature; see spec Assumptions.
- Any monetary/cost field — not modeled; see spec Assumptions.

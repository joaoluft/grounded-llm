# Optional `fallbackValue` design

Date: 2026-07-16

## Problem

`fallbackValue` is mandatory today on every component (`GroundedGenerator`,
`GroundedEnricher`, `GroundedExtractor`). For `GroundedGenerator` specifically, this
forces a hard rule: insufficient context always short-circuits to a fixed,
developer-configured string, even when the caller would rather let the model produce
a best-effort answer (e.g. general-knowledge response, or a clarifying question back
to the user). `GroundedGenerator` isn't only used for strict Q&A — it can also drive
free-form generation where a canned fallback string is the wrong tool. That behavior
(returning something fixed instead of model output) already exists and belongs to
`GroundedEnricher`, which always returns `baseContent` unchanged on insufficient
context — never `fallbackValue`.

## Decision

Make `fallbackValue` optional across all three components. Its presence/absence
changes behavior only where it previously mattered:

- **`GroundedGenerator`**: the component gains a real "no fallback configured" mode.
- **`GroundedEnricher`**: no functional change — it never returned `fallbackValue` on
  any success path anyway; this is a type-level change only.
- **`GroundedExtractor`**: gains a "no fallback configured" mode too.

## A. Types

- `GroundedCallConfig.fallbackValue` becomes `fallbackValue?: TFallback`.
- `GroundedExtractionConfig.fallbackValue` becomes `fallbackValue?: ExtractionData<Fields>`.
- `GroundedCall`'s constructor validation changes from "required, throws if
  undefined/null/empty-string" to "if provided, must not be empty-string; `undefined`
  is accepted."

## B. `GroundedGenerator`

The system prompt gains a conditional step 4, selected once at call time based on
whether `fallbackValue` is configured:

- **With fallback (current behavior, unchanged)**: "If not sufficient, or if no
  relevant excerpt exists, set `sufficient_context` to false and leave `final_answer`
  empty — a fallback will be used instead of your answer."
- **Without fallback (new)**: "If not sufficient, or if no relevant excerpt exists,
  you must still answer as helpfully as possible — using general knowledge, or asking
  the user a clarifying question. Never leave `final_answer` empty. `sufficient_context`,
  `extracted_facts`, and `reasoning` must still truthfully reflect the grounding
  assessment."

`generate()` flow:

1. **Empty/blank `context`**:
   - Fallback configured → unchanged: return fallback result without calling the
     model.
   - No fallback configured → call the model anyway (empty context, no-fallback
     prompt variant), so the model can still answer.
2. **After the model call, when `!sufficient_context` or no extracted facts**:
   - Fallback configured → unchanged: return `fallbackValue`, `usedFallback: true`.
   - No fallback configured → return `output.final_answer` as the real answer,
     `usedFallback: false` (the model was instructed to always fill it).
3. **Sufficient context** (unchanged in both cases): return the model's answer,
   `usedFallback: false`.

`usedFallback` is `true` only when `fallbackValue` was actually substituted for the
model's output. It is always `false` when `fallbackValue` isn't configured.

The response schema (`groundedGenerationSchema`) is unchanged — `final_answer` is
always a string field; only the prompt instructions vary.

## C. `GroundedEnricher`

No behavior change. `fallbackValue` becomes optional at the type level only — the
enrichment logic already ignores it (insufficient context returns `baseContent`
unchanged, never `fallbackValue`).

## D. `GroundedExtractor`

- **Fallback configured (unchanged)**: `strict: true` + any missing field, or nothing
  extracted at all → return the whole `fallbackValue` object, `usedFallback: true`.
- **No fallback configured (new)**: `strict` is ignored (always treated as `false`).
  Both the "nothing extracted" and "partial extraction" cases return the extracted
  data as produced by the model (missing fields as `null`), never throwing and never
  substituting a fallback object. `usedFallback` is always `false`.

## Testing

- All existing tests (fallback configured) must keep passing unchanged — this is a
  backward-compatible change for callers who already set `fallbackValue`.
- New tests:
  - `GroundedGenerator` without `fallbackValue`, insufficient context → model's answer
    returned, `usedFallback: false`.
  - `GroundedGenerator` without `fallbackValue`, empty/blank `context` → model is
    still called and its answer returned.
  - `GroundedExtractor` without `fallbackValue`, nothing extracted / partial with
    `strict: true` → returns nulled-out partial data, never throws, `usedFallback:
    false`.

## Documentation

Update README (EN/PT) to describe `fallbackValue` as optional, and the new
`GroundedGenerator` behavior when it's absent (model always answers; no canned
fallback string).

## Out of scope

- No new config flags are introduced — behavior is driven purely by whether
  `fallbackValue` is present.
- No change to `GroundedEnricher`'s runtime logic.
- No change to the response schemas' shape.

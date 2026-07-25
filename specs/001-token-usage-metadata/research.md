# Phase 0 Research: Token Usage & Cost Metadata

No open technical unknowns remain from the Technical Context (stack, testing, target platform are all already fixed by the existing codebase). Research below resolves the two design questions raised while writing the spec.

## Decision 1: Where usage data comes from, and where it's currently lost

- **Decision**: Source `usage` from `ProviderResponse.usage` (`src/providers/types.ts:19-31`), already populated per-provider:
  - OpenAI: `src/providers/openai.ts:98-104` from `completion.usage.{prompt_tokens,completion_tokens,total_tokens}`
  - Anthropic: `src/providers/anthropic.ts:85-89` from `response.usage.{input_tokens,output_tokens}`
  - Google: `src/providers/google.ts:82-92` from `response.usageMetadata.{promptTokenCount,candidatesTokenCount,totalTokenCount}`
- **Rationale**: All three adapters already normalize usage into the shared `ProviderUsage` shape. The only gap is `GroundedCall.callModel` (`src/core/grounded-call.ts:199-200`), which discards it (`return response.data;`), and each generator's `do*` method, which never receives it. No new provider-side work is needed — this is purely a threading problem.
- **Alternatives considered**: Re-deriving usage from raw text via a tokenizer estimate — rejected, since accurate provider-reported counts already exist and an estimate would be strictly worse and misleading as "usage".

## Decision 2: `langchainModel` mode behavior

- **Decision**: Leave `usage` as `undefined` for `langchainModel` mode in this feature. Do not change `LangChainModelClient.parse()` (`src/core/langchain-model-client.ts:28-58`) to request `includeRaw: true`.
- **Rationale**: The issue's acceptance criteria only require `result.usage` to be correct in standalone mode, and require documenting that it may be `undefined` in `langchainModel` mode — they do not require extracting it there. Adding `includeRaw: true` would change the shape of what `withStructuredOutput(...).invoke()` returns (from the parsed object to `{ raw, parsed }`) and touch a code path with no test coverage today for that branch; that's a larger, separate change better scoped as its own follow-up if wanted.
- **Alternatives considered**: Extracting `raw.usage_metadata` via `includeRaw: true` now — rejected as out of scope per spec Assumptions; would also require handling multiple possible shapes (`usage_metadata` vs `response_metadata.tokenUsage`) depending on which LangChain chat model integration is wrapped, adding risk disproportionate to this issue's ask.

## Decision 3: Fallback-path usage semantics

- **Decision**: When a generator falls back (e.g., after a retry), `usage` reflects whatever the actual underlying call(s) produced; if the fallback path itself makes no model call, `usage` is simply omitted.
- **Rationale**: Matches spec edge case — "usage MUST be absent, never fabricated." Each generator's existing fallback builder (`buildFallbackResult` in `grounded-generator.ts`/`grounded-extractor.ts`, inline in `grounded-enricher.ts`/`grounded-composer.ts`) already runs independently of the success path return; usage threading follows the same call-site pattern as `usedFallback` already does.
- **Alternatives considered**: Summing usage across every retry attempt automatically — rejected as an unrequested behavior expansion; per FR-002/FR-004, correctness in the (single) standalone success path is what's required, and generators do not currently retry-and-sum any other metadata either.

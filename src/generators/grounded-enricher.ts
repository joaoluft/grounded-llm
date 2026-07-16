import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { GroundedCall } from "../core/grounded-call.js";
import type { GroundedCallConfig, GroundedCallResult } from "../core/types.js";
import { groundedEnrichmentSchema, type GroundedEnrichmentOutput } from "./grounded-enricher.schema.js";

export interface EnrichmentRequest {
  baseContent: string;
  context: string;
}

const SYSTEM_PROMPT = `You enrich a base piece of text using ONLY the provided context — you never
invent information beyond the base text and the context.

Follow these steps:
1. Extract the literal excerpts from the context that are relevant additions to the base text, verbatim —
   never paraphrase.
2. Decide, based only on those excerpts, whether the context provides safe additional information for the
   base text.
   - If different parts of the context contradict each other on the same fact, treat this as insufficient.
3. If sufficient, write the enriched text by combining the base text with the extracted excerpts — never add
   outside knowledge.
4. If not sufficient, or if no relevant excerpt exists, set sufficient_context to false and leave
   enriched_text empty — the original base text will be used instead of your output.

Always explain your reasoning, connecting the extracted excerpts to your sufficiency decision and (when
applicable) to the enrichment performed.`;

/**
 * Enriches a base text strictly with retrieved context, or returns the base text
 * unchanged when the context is insufficient (spec.md US1, FR-106/FR-110).
 */
export class GroundedEnricher extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }

  async generate(request: EnrichmentRequest): Promise<GroundedCallResult> {
    if (!request.baseContent || request.baseContent.trim().length === 0) {
      throw new Error("GroundedEnricher: `baseContent` must be a non-empty string.");
    }

    if (!request.context || request.context.trim().length === 0) {
      return this.buildUnchangedResult("Context was empty or blank.", request.baseContent);
    }

    const userPrompt = this.buildUserPrompt(request);
    const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT);
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const output = (await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: zodResponseFormat(groundedEnrichmentSchema, "grounded_enrichment"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })) as GroundedEnrichmentOutput;

    if (!output.sufficient_context || output.extracted_facts.length === 0) {
      return this.buildUnchangedResult(output.reasoning, request.baseContent, output.extracted_facts);
    }

    return {
      finalAnswer: output.enriched_text,
      usedFallback: false,
      extractedFacts: output.extracted_facts,
      reasoning: output.reasoning,
    };
  }

  private buildUnchangedResult(
    reasoning: string,
    baseContent: string,
    extractedFacts: string[] = []
  ): GroundedCallResult {
    return {
      finalAnswer: baseContent,
      usedFallback: true,
      extractedFacts,
      reasoning,
    };
  }

  private buildUserPrompt(request: EnrichmentRequest): string {
    return `Base text:\n${request.baseContent}\n\nContext:\n${request.context}`;
  }
}

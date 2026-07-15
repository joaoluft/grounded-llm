import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { GroundedCall } from "../core/GroundedCall.js";
import type { GroundedCallConfig, GroundedCallResult } from "../core/types.js";
import { groundedGenerationSchema, type GroundedGenerationOutput } from "./schema.js";

export interface GenerationRequest {
  context: string;
  question: string;
}

const SYSTEM_PROMPT = `You answer questions using ONLY the provided context.

Follow these steps:
1. Extract the literal excerpts from the context that are relevant to the question, verbatim — never paraphrase.
2. Decide, based only on those excerpts, whether the context is sufficient to answer the question safely.
   - If different parts of the context contradict each other on the same fact, treat this as insufficient.
   - If the context is only partially related to the question, judge whether that partial information is enough
     to answer safely; if not, treat it as insufficient.
3. If sufficient, write a final answer using only information present in the extracted excerpts — never add
   outside knowledge.
4. If not sufficient, or if no relevant excerpt exists, set sufficient_context to false and leave final_answer
   empty — a fallback will be used instead of your answer.

Always explain your reasoning, connecting the extracted excerpts to your sufficiency decision and (when
applicable) to the final answer.`;

/**
 * Generates a final answer strictly grounded in retrieved context, or defers to a
 * developer-configured fallback when the context is insufficient (spec.md US1/US2).
 */
export class GroundedGenerator extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }

  async generate(request: GenerationRequest): Promise<GroundedCallResult> {
    if (!request.question || request.question.trim().length === 0) {
      throw new Error("GroundedGenerator: `question` must be a non-empty string.");
    }

    if (!request.context || request.context.trim().length === 0) {
      return this.buildFallbackResult("Context was empty or blank.");
    }

    const userPrompt = this.buildUserPrompt(request);
    const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT);
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const output = (await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: zodResponseFormat(groundedGenerationSchema, "grounded_generation"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })) as GroundedGenerationOutput;

    if (!output.sufficient_context || output.extracted_facts.length === 0) {
      return this.buildFallbackResult(output.reasoning, output.extracted_facts);
    }

    return {
      finalAnswer: output.final_answer,
      usedFallback: false,
      extractedFacts: output.extracted_facts,
      reasoning: output.reasoning,
    };
  }

  private buildFallbackResult(reasoning: string, extractedFacts: string[] = []): GroundedCallResult {
    return {
      finalAnswer: this.fallbackValue,
      usedFallback: true,
      extractedFacts,
      reasoning,
    };
  }

  private buildUserPrompt(request: GenerationRequest): string {
    return `Context:\n${request.context}\n\nQuestion: ${request.question}`;
  }
}

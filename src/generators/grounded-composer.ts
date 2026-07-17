import { zodResponseFormat } from 'openai/helpers/zod.mjs';
import { GroundedCall } from '../core/grounded-call.js';
import type { GroundedCallConfig, GroundedCallResult } from '../core/types.js';
import {
  groundedCompositionSchema,
  type GroundedCompositionOutput,
} from './grounded-composer.schema.js';

export interface ComposerRequest {
  instructions: string;
  context?: string;
}

const SYSTEM_PROMPT = `You compose a final message strictly from the instructions provided for this
call — instructions are the mandatory, primary source of the message's content.

Follow these steps:
1. Extract the literal excerpts from the instructions that determine the message to be composed,
   verbatim — never paraphrase. This MUST never be empty.
2. If conversation data (context) is provided, decide whether any part of it is relevant to this
   message — for example, a conflict with the instructions, acknowledging progress, or referencing
   data already mentioned. This is support only: context is never a requirement, and its absence or
   irrelevance never blocks the message.
3. If context is relevant, extract the literal excerpts from it that support that relevance.
4. Compose the final message strictly from the instructions (and, when relevant, the context excerpts) —
   never add outside knowledge. The final message MUST always be produced; there is no valid outcome
   where it is left empty or replaced by a refusal.

Always explain your reasoning, connecting the extracted instruction excerpts (and context excerpts,
when used) to the final message.`;

/**
 * Composes a final message anchored primarily in developer-supplied instructions for
 * this call, treating context as optional support only. Unlike GroundedGenerator/
 * GroundedEnricher, this component never abstains or falls back — a message is
 * always produced (spec 007-grounded-composer FR-705).
 */
export class GroundedComposer extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }

  async compose(request: ComposerRequest): Promise<GroundedCallResult> {
    if (!request.instructions || request.instructions.trim().length === 0) {
      throw new Error('GroundedComposer: `instructions` must be a non-empty string.');
    }

    const userPrompt = this.buildUserPrompt(request);
    const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT);
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const output = (await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: zodResponseFormat(groundedCompositionSchema, 'grounded_composition'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })) as GroundedCompositionOutput;

    return {
      finalAnswer: output.final_message,
      usedFallback: false,
      extractedFacts: [...output.applied_rules, ...output.context_excerpts],
      reasoning: output.reasoning,
    };
  }

  private buildUserPrompt(request: ComposerRequest): string {
    const hasContext = Boolean(request.context && request.context.trim().length > 0);
    return hasContext
      ? `Instructions:\n${request.instructions}\n\nContext:\n${request.context}`
      : `Instructions:\n${request.instructions}\n\nContext: (none provided)`;
  }
}

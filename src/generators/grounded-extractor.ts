import { z } from 'zod';
import type OpenAI from 'openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { GroundedCall } from '../core/grounded-call.js';
import { buildExtractionSchema } from './grounded-extractor.schema.js';

/** Maps a developer-provided fields shape to its extracted-value shape (each field nullable). */
export type ExtractionData<Fields extends z.ZodRawShape> = {
  [K in keyof Fields]: z.infer<Fields[K]> | null;
};

export interface GroundedExtractionConfig<Fields extends z.ZodRawShape> {
  /** Developer-defined fields to extract from the user message (FR-201). */
  fields: Fields;
  /** Optional whole-object fallback, same shape as `fields` (FR-205). When omitted, `extract()` always returns the model's raw (nullable) extraction instead (003-optional-fallback FR-009). */
  fallbackValue?: ExtractionData<Fields>;
  /** Default `false`. Whether partial extraction is accepted (FR-211). */
  strict?: boolean;
  client?: OpenAI;
  apiKey?: string;
  model?: string;
  temperature?: number;
  /**
   * Pre-configured LangChain chat model, used instead of a native OpenAI client so
   * calls keep flowing through the developer's own LangChain/LangSmith tracing setup
   * (006-langchain-model-support). Mutually exclusive with `client`/`apiKey`/`model`/
   * `temperature`. Same field and behavior as `GroundedCallConfig.langchainModel` —
   * declared here too because this interface does not extend `GroundedCallConfig`.
   */
  langchainModel?: BaseChatModel;
  maxContextTokens?: number;
  /** Optional developer-supplied role/objective for this call, appended after the built-in instructions. */
  identity?: string;
  /** Optional developer-supplied rules for this call, appended after the built-in instructions. */
  rules?: string;
  /** Optional developer-supplied tone/personality description for this call, appended after `identity`/`rules`. */
  tone?: string;
}

export interface GroundedExtractionResult<Fields extends z.ZodRawShape> {
  data: ExtractionData<Fields>;
  usedFallback: boolean;
  reasoning: string;
}

export interface ExtractionRequest {
  message: string;
}

const SYSTEM_PROMPT_PREFIX = `You extract structured information from a user message using ONLY the
content of that message — you never invent values.

For each field, extract its value only if the message clearly supports it; otherwise leave it null.
Always explain your reasoning, connecting the message content to the values you extracted (or to why a
field was left null).`;

/**
 * Extracts a developer-defined structured object from a user message, with a
 * mandatory whole-object fallback and a `strict` mode controlling whether partial
 * extraction is accepted (spec.md US2).
 */
export class GroundedExtractor<Fields extends z.ZodRawShape> extends GroundedCall<
  ExtractionData<Fields>
> {
  private readonly fields: Fields;
  private readonly strict: boolean;
  private readonly schema: ReturnType<typeof buildExtractionSchema<Fields>>['schema'];
  private readonly responseFormat: ReturnType<
    typeof buildExtractionSchema<Fields>
  >['responseFormat'];

  constructor(config: GroundedExtractionConfig<Fields>) {
    if (!config.fields) {
      throw new Error('GroundedExtractor: `fields` is required.');
    }
    super(config);
    this.fields = config.fields;
    this.strict = config.strict ?? false;
    const built = buildExtractionSchema(this.fields);
    this.schema = built.schema;
    this.responseFormat = built.responseFormat;
  }

  async extract(request: ExtractionRequest): Promise<GroundedExtractionResult<Fields>> {
    if (!request.message || request.message.trim().length === 0) {
      return this.buildFallbackResult('Message was empty or blank.');
    }

    const userPrompt = `Message:\n${request.message}`;
    const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT_PREFIX);
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const output = (await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: this.responseFormat,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })) as z.infer<typeof this.schema>;

    const { reasoning, ...extracted } = output as {
      reasoning: string;
    } & Record<string, unknown>;
    const data = extracted as ExtractionData<Fields>;

    const fieldKeys = Object.keys(this.fields) as (keyof Fields)[];
    const values = fieldKeys.map((key) => data[key]);
    const allNull = values.every((value) => value === null);
    const someNull = values.some((value) => value === null);
    const hasFallback = this.fallbackValue !== undefined;

    const shouldFallback = hasFallback && (allNull || (someNull && this.strict));
    if (shouldFallback) {
      return this.buildFallbackResult(reasoning);
    }

    return { data, usedFallback: false, reasoning };
  }

  private buildEmptyData(): ExtractionData<Fields> {
    const fieldKeys = Object.keys(this.fields) as (keyof Fields)[];
    return Object.fromEntries(fieldKeys.map((key) => [key, null])) as ExtractionData<Fields>;
  }

  private buildFallbackResult(reasoning: string): GroundedExtractionResult<Fields> {
    if (this.fallbackValue !== undefined) {
      return { data: this.fallbackValue, usedFallback: true, reasoning };
    }
    return { data: this.buildEmptyData(), usedFallback: false, reasoning };
  }
}

import { z } from 'zod';
import { GroundedCall } from '../core/grounded-call.js';
import { InvalidModelOutputError } from '../core/errors.js';
import { buildExtractionSchema } from './grounded-extractor.schema.js';

/** Maps a developer-provided fields shape to its extracted-value shape (each field nullable). */
export type ExtractionData<Fields extends z.ZodRawShape> = {
  [K in keyof Fields]: z.infer<Fields[K]> | null;
};

import type { GroundedCallConfig } from '../core/types.js';

export interface GroundedExtractionConfig<Fields extends z.ZodRawShape> extends GroundedCallConfig<
  ExtractionData<Fields>
> {
  /** Developer-defined fields to extract from the user message (FR-201). */
  fields: Fields;
  /** Optional whole-object fallback, same shape as `fields` (FR-205). When omitted, `extract()` always returns the model's raw (nullable) extraction instead (003-optional-fallback FR-009). */
  fallbackValue?: ExtractionData<Fields>;
  /** Default `false`. Whether partial extraction is accepted (FR-211). */
  strict?: boolean;
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
    return this.withLifecycle('GroundedExtractor.extract', () => this.doExtract(request));
  }

  private async doExtract(request: ExtractionRequest): Promise<GroundedExtractionResult<Fields>> {
    if (!request.message || request.message.trim().length === 0) {
      return this.buildFallbackResult('Message was empty or blank.');
    }

    const userPrompt = `Message:\n${request.message}`;
    const systemPrompt = this.buildSystemPrompt(SYSTEM_PROMPT_PREFIX);
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const rawOutput = await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: this.responseFormat,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    // The OpenAI backend enforces this shape server-side (`strict: true`), but the
    // langchainModel backend only guarantees the response isn't null/undefined
    // (LangChainModelClient) — some LangChain chat model integrations don't enforce
    // required/nullable fields as strictly, so this validates defensively before use.
    const parseResult = this.schema.safeParse(rawOutput);
    if (!parseResult.success) {
      throw new InvalidModelOutputError(
        `GroundedExtractor: model response did not match the expected schema: ${parseResult.error.message}`
      );
    }
    const output = parseResult.data;

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

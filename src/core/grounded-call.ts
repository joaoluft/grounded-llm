import OpenAI from 'openai';
import type { ChatCompletionParseParams } from 'openai/resources/beta/chat/completions.mjs';
import type { GroundedCallConfig } from './types.js';
import { ContextTooLargeError } from './errors.js';
import { estimateTokens, getMaxContextTokens } from './context-window.js';
import type { ModelClient, ParsedModelOutput } from './model-client.js';
import { OpenAiModelClient } from './model-client.js';
import { LangChainModelClient } from './langchain-model-client.js';

/** Default context-window limit used in LangChain mode, where there is no OpenAI `model` id to derive a known limit from (006-langchain-model-support FR-004). */
const LANGCHAIN_MODE_DEFAULT_MAX_CONTEXT_TOKENS = 128_000;

/**
 * Shared base for components that call an OpenAI chat model with structured output,
 * a mandatory fallback, and a distinct operational-error surface (FR-005, FR-008,
 * FR-010, FR-011, FR-012). Reusable by a future `GroundedDecider` — keep this file
 * free of `GroundedGenerator`-specific behavior.
 */
export abstract class GroundedCall<TFallback = string> {
  protected readonly client?: OpenAI;
  protected readonly modelClient: ModelClient;
  protected readonly model: string;
  protected readonly fallbackValue?: TFallback;
  protected readonly temperature: number;
  protected readonly maxContextTokens: number;
  protected readonly identity?: string;
  protected readonly rules?: string;
  protected readonly tone?: string;

  constructor(config: GroundedCallConfig<TFallback>) {
    const isEmptyString =
      typeof config.fallbackValue === 'string' && config.fallbackValue.trim().length === 0;
    if (config.fallbackValue === null || isEmptyString) {
      throw new Error('GroundedCall: `fallbackValue`, when provided, must not be empty.');
    }
    this.fallbackValue = config.fallbackValue;

    if (config.langchainModel) {
      if (
        config.client ||
        config.apiKey !== undefined ||
        config.model !== undefined ||
        config.temperature !== undefined
      ) {
        throw new Error(
          'GroundedCall: `langchainModel` cannot be combined with `client`, `apiKey`, `model`, or ' +
            '`temperature` — these two modes are mutually exclusive. The LangChain chat model already ' +
            'carries its own credentials, model id, and temperature.'
        );
      }
      this.model = 'langchain-model';
      this.modelClient = new LangChainModelClient(config.langchainModel);
      this.maxContextTokens = config.maxContextTokens ?? LANGCHAIN_MODE_DEFAULT_MAX_CONTEXT_TOKENS;
    } else if (config.client) {
      this.client = config.client;
      if (config.model !== undefined && config.model.trim().length === 0) {
        throw new Error('GroundedCall: `model` must not be an empty string.');
      }
      this.model = config.model ?? 'gpt-4o-mini';
      this.modelClient = new OpenAiModelClient(this.client);
      this.maxContextTokens = config.maxContextTokens ?? getMaxContextTokens(this.model);
    } else {
      if (config.model !== undefined && config.model.trim().length === 0) {
        throw new Error('GroundedCall: `model` must not be an empty string.');
      }
      this.model = config.model ?? 'gpt-4o-mini';

      const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(
          'GroundedCall: no `apiKey` provided and OPENAI_API_KEY is not set in the environment.'
        );
      }
      this.client = new OpenAI({ apiKey });
      this.modelClient = new OpenAiModelClient(this.client);
      this.maxContextTokens = config.maxContextTokens ?? getMaxContextTokens(this.model);
    }

    this.temperature = config.temperature ?? 0;
    this.identity = config.identity;
    this.rules = config.rules;
    this.tone = config.tone;
  }

  /**
   * Appends the developer-supplied `identity`/`rules`/`tone` (if provided) as
   * additional sections after `basePrompt`, in that order, so they can never
   * override the component's built-in grounding instructions.
   */
  protected buildSystemPrompt(basePrompt: string): string {
    let prompt = basePrompt;
    if (this.identity) {
      prompt += `\n\nYour role for this call:\n${this.identity}`;
    }
    if (this.rules) {
      prompt += `\n\nAdditional rules for this call (these do not override the grounding rules above):\n${this.rules}`;
    }
    if (this.tone && this.tone.trim().length > 0) {
      prompt += `\n\nTone/personality for this call (this complements, but never overrides, the grounding rules above):\n${this.tone}`;
    }
    return prompt;
  }

  /** Throws ContextTooLargeError (FR-011) without calling the model. */
  protected assertContextWithinLimit(promptText: string): void {
    const estimated = estimateTokens(promptText);
    if (estimated > this.maxContextTokens) {
      throw new ContextTooLargeError(
        `Estimated prompt size (~${estimated} tokens) exceeds the configured limit of ` +
          `${this.maxContextTokens} tokens for model "${this.model}".`
      );
    }
  }

  /**
   * Calls the model with structured-output parsing, translating failures into the
   * distinct operational-error types (FR-010, FR-012). Never retries automatically.
   * Delegates to `this.modelClient`, which is either `OpenAiModelClient` (standalone
   * mode) or `LangChainModelClient` (006-langchain-model-support) — the two backends
   * share this exact same call surface, so no other method needs to know which one
   * is in use.
   */
  protected async callModel<Params extends ChatCompletionParseParams>(
    params: Params
  ): Promise<ParsedModelOutput> {
    return this.modelClient.parse(params);
  }
}

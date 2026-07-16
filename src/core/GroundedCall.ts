import OpenAI from "openai";
import { LengthFinishReasonError, ContentFilterFinishReasonError } from "openai/error.mjs";
import type { ChatCompletionParseParams, ParsedChatCompletion } from "openai/resources/beta/chat/completions.mjs";
import type { GroundedCallConfig } from "./types.js";
import { ModelUnavailableError, ContextTooLargeError, InvalidModelOutputError } from "./errors.js";
import { estimateTokens, getMaxContextTokens } from "./contextWindow.js";

/**
 * Shared base for components that call an OpenAI chat model with structured output,
 * a mandatory fallback, and a distinct operational-error surface (FR-005, FR-008,
 * FR-010, FR-011, FR-012). Reusable by a future `GroundedDecider` — keep this file
 * free of `GroundedGenerator`-specific behavior.
 */
export abstract class GroundedCall<TFallback = string> {
  protected readonly client: OpenAI;
  protected readonly model: string;
  protected readonly fallbackValue?: TFallback;
  protected readonly temperature: number;
  protected readonly maxContextTokens: number;
  protected readonly identity?: string;
  protected readonly rules?: string;
  protected readonly tone?: string;

  constructor(config: GroundedCallConfig<TFallback>) {
    const isEmptyString = typeof config.fallbackValue === "string" && config.fallbackValue.trim().length === 0;
    if (config.fallbackValue === null || isEmptyString) {
      throw new Error("GroundedCall: `fallbackValue`, when provided, must not be empty.");
    }
    this.fallbackValue = config.fallbackValue;

    if (config.client) {
      this.client = config.client;
      if (config.model !== undefined && config.model.trim().length === 0) {
        throw new Error("GroundedCall: `model` must not be an empty string.");
      }
      this.model = config.model ?? "gpt-4o-mini";
    } else {
      if (config.model !== undefined && config.model.trim().length === 0) {
        throw new Error("GroundedCall: `model` must not be an empty string.");
      }
      this.model = config.model ?? "gpt-4o-mini";

      const apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"];
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(
          "GroundedCall: no `apiKey` provided and OPENAI_API_KEY is not set in the environment."
        );
      }
      this.client = new OpenAI({ apiKey });
    }

    this.temperature = config.temperature ?? 0;
    this.maxContextTokens = config.maxContextTokens ?? getMaxContextTokens(this.model);
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
   */
  protected async callModel<Params extends ChatCompletionParseParams>(
    params: Params
  ): Promise<NonNullable<ParsedChatCompletion<unknown>["choices"][number]["message"]["parsed"]>> {
    let completion: ParsedChatCompletion<unknown>;
    try {
      completion = await this.client.beta.chat.completions.parse(params);
    } catch (error) {
      if (error instanceof LengthFinishReasonError || error instanceof ContentFilterFinishReasonError) {
        throw new InvalidModelOutputError(
          `Model response failed structured output validation: ${error.message}`,
          { cause: error }
        );
      }
      throw new ModelUnavailableError(
        `Call to the OpenAI model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new InvalidModelOutputError(`Model refused to respond: ${message.refusal}`);
    }
    if (!message || message.parsed === null || message.parsed === undefined) {
      throw new InvalidModelOutputError("Model response could not be parsed against the expected schema.");
    }
    return message.parsed;
  }
}

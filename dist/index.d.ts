import OpenAI from 'openai';
import { ChatCompletionParseParams, ParsedChatCompletion } from 'openai/resources/beta/chat/completions.mjs';

interface GroundedCallConfig {
    /** Pre-configured OpenAI client instance. When provided, used as-is (FR-008). */
    client?: OpenAI;
    /** Used only when `client` is not provided. Defaults to `OPENAI_API_KEY`. */
    apiKey?: string;
    /** Used only when `client` is not provided. Defaults to `"gpt-4o-mini"`. */
    model?: string;
    /** Required. No implicit default (FR-005). */
    fallbackValue: string;
    /** Defaults to `0` (constitution principle 6). */
    temperature?: number;
    /** Default derived from the known limit of `model`, when available (FR-011). */
    maxContextTokens?: number;
}
interface GroundedCallResult {
    finalAnswer: string;
    usedFallback: boolean;
    extractedFacts: string[];
    reasoning: string;
}

/**
 * Shared base for components that call an OpenAI chat model with structured output,
 * a mandatory fallback, and a distinct operational-error surface (FR-005, FR-008,
 * FR-010, FR-011, FR-012). Reusable by a future `GroundedDecider` — keep this file
 * free of `GroundedGenerator`-specific behavior.
 */
declare abstract class GroundedCall {
    protected readonly client: OpenAI;
    protected readonly model: string;
    protected readonly fallbackValue: string;
    protected readonly temperature: number;
    protected readonly maxContextTokens: number;
    constructor(config: GroundedCallConfig);
    /** Throws ContextTooLargeError (FR-011) without calling the model. */
    protected assertContextWithinLimit(promptText: string): void;
    /**
     * Calls the model with structured-output parsing, translating failures into the
     * distinct operational-error types (FR-010, FR-012). Never retries automatically.
     */
    protected callModel<Params extends ChatCompletionParseParams>(params: Params): Promise<NonNullable<ParsedChatCompletion<unknown>["choices"][number]["message"]["parsed"]>>;
}

/** Technical failure calling the model: unavailability, timeout, communication error (FR-010). */
declare class ModelUnavailableError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/** Provided context exceeds the model's processable limit, with safety margin (FR-011). */
declare class ContextTooLargeError extends Error {
    constructor(message: string);
}
/** Model response fails structured-output schema validation, or is refused (FR-012). */
declare class InvalidModelOutputError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}

interface GenerationRequest {
    context: string;
    question: string;
}
/**
 * Generates a final answer strictly grounded in retrieved context, or defers to a
 * developer-configured fallback when the context is insufficient (spec.md US1/US2).
 */
declare class GroundedGenerator extends GroundedCall {
    constructor(config: GroundedCallConfig);
    generate(request: GenerationRequest): Promise<GroundedCallResult>;
    private buildFallbackResult;
    private buildUserPrompt;
}

export { ContextTooLargeError, type GenerationRequest, GroundedCall, type GroundedCallConfig, type GroundedCallResult, GroundedGenerator, InvalidModelOutputError, ModelUnavailableError };

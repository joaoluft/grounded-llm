import type OpenAI from 'openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { LLMProviderContract } from '../providers/types.js';
import type { CallEvent, ResultEvent, ErrorEvent } from './lifecycle-callbacks.js';

/**
 * Generic over the fallback shape so components with a non-string fallback (e.g.
 * `GroundedExtractor`'s whole-object fallback) can still reuse `GroundedCall`.
 * Defaults to `string`, matching `GroundedGenerator`/`GroundedEnricher`.
 */
export interface GroundedCallConfig<TFallback = string> {
  /** Pre-configured OpenAI client instance. When provided, used as-is (FR-008). */
  client?: OpenAI;
  /** Used only when `client` is not provided. Defaults to `OPENAI_API_KEY`. */
  apiKey?: string;
  /** Optional provider name ('openai', 'anthropic', 'google'). Resolved via precedence (param > env > default). */
  provider?: string;
  /** Optional provider-specific non-secret configuration options. */
  providerOptions?: Record<string, any>;
  /** Optional direct custom provider adapter instance. */
  providerAdapter?: LLMProviderContract;
  /** Model selection name. Defaults to provider default (e.g. "gpt-4o-mini" for OpenAI). */
  model?: string;
  /**
   * Pre-configured LangChain chat model, used instead of a native OpenAI client so
   * calls keep flowing through the developer's own LangChain/LangSmith tracing setup
   * (006-langchain-model-support FR-001/FR-002). Mutually exclusive with `client`,
   * `apiKey`, `model`, and `temperature` — the chat model already carries its own
   * credentials, model id, and temperature; combining it with any of those throws a
   * configuration error at construction (FR-003). When used without an explicit
   * `maxContextTokens`, a conservative default of 128 000 tokens applies (FR-004),
   * since there is no OpenAI `model` id to derive a known limit from.
   */
  langchainModel?: BaseChatModel;
  /** Optional. When omitted, the component must produce a real result instead of a canned fallback (003-optional-fallback FR-001). */
  fallbackValue?: TFallback;
  /** Defaults to `0` (constitution principle 6). */
  temperature?: number;
  /** Default derived from the known limit of `model`, when available (FR-011). */
  maxContextTokens?: number;
  /**
   * Optional developer-supplied role/objective for this call (e.g. "You are the
   * support assistant for Acme Corp"). Appended as an additional system-prompt
   * section, always after the component's built-in grounding instructions — it
   * never overrides them.
   */
  identity?: string;
  /**
   * Optional developer-supplied rules constraining this call (e.g. tone, style,
   * domain-specific constraints). Appended as an additional system-prompt section,
   * always after the component's built-in grounding instructions — it never
   * overrides them.
   */
  rules?: string;
  /**
   * Optional developer-supplied tone/personality description for this call (e.g.
   * "seja empático e gentil"). Appended as an additional system-prompt section,
   * always after `identity` and `rules` — it never overrides the component's
   * built-in grounding instructions.
   */
  tone?: string;
  /**
   * Optional lifecycle callback fired once per call attempt, before the model is
   * reached. Synchronous/fire-and-forget: never awaited, and an exception it throws
   * is caught and discarded, never affecting the call's own result (008-structured-logging-hooks FR-002, FR-007).
   */
  onCall?: (event: CallEvent) => void;
  /**
   * Optional lifecycle callback fired once per call attempt, after it completes
   * successfully. Synchronous/fire-and-forget, same isolation guarantee as `onCall`
   * (008-structured-logging-hooks FR-003, FR-007).
   */
  onResult?: (event: ResultEvent) => void;
  /**
   * Optional lifecycle callback fired once per call attempt, after it fails.
   * Synchronous/fire-and-forget, same isolation guarantee as `onCall`
   * (008-structured-logging-hooks FR-004, FR-007).
   */
  onError?: (event: ErrorEvent) => void;
}

export interface GroundedCallResult {
  finalAnswer: string;
  usedFallback: boolean;
  extractedFacts: string[];
  reasoning: string;
}

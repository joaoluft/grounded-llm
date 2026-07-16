import type OpenAI from "openai";

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
  /** Used only when `client` is not provided. Defaults to `"gpt-4o-mini"`. */
  model?: string;
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
}

export interface GroundedCallResult {
  finalAnswer: string;
  usedFallback: boolean;
  extractedFacts: string[];
  reasoning: string;
}

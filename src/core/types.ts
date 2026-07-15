import type OpenAI from "openai";

export interface GroundedCallConfig {
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

export interface GroundedCallResult {
  finalAnswer: string;
  usedFallback: boolean;
  extractedFacts: string[];
  reasoning: string;
}

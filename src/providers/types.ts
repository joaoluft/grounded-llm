import type { ZodSchema } from 'zod';

export interface ProviderCapabilityProfile {
  streaming?: boolean;
  embeddings?: boolean;
  structuredOutput?: boolean;
}

export interface ProviderRequest {
  operation: 'completeStructured';
  model: string;
  temperature?: number;
  systemInstruction?: string;
  prompt: string;
  schema?: ZodSchema<any> | Record<string, any>;
  context?: Record<string, any>;
}

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderResponse<T = unknown> {
  data: T;
  rawText?: string;
  usage?: ProviderUsage;
  finishStatus: 'stop' | 'length' | 'content_filter' | 'error' | string;
  providerMeta?: Record<string, unknown>;
}

export interface LLMProviderContract {
  readonly providerId: string;
  readonly capabilities: ProviderCapabilityProfile;

  completeStructured<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>>;
  stream?(request: ProviderRequest): AsyncIterable<unknown>;
  embed?(request: unknown): Promise<unknown>;
}

export type SupportedProviderId = 'openai' | 'anthropic' | 'google' | (string & {});

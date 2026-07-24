import { GoogleGenAI } from '@google/genai';
import type {
  LLMProviderContract,
  ProviderCapabilityProfile,
  ProviderRequest,
  ProviderResponse,
} from './types.js';
import { validateProviderCredentials } from './config.js';
import { InvalidModelOutputError, ModelUnavailableError, ProviderError } from '../core/errors.js';

export interface GoogleAdapterOptions {
  client?: GoogleGenAI;
  apiKey?: string;
}

export class GoogleProviderAdapter implements LLMProviderContract {
  readonly providerId = 'google';
  readonly capabilities: ProviderCapabilityProfile = {
    structuredOutput: true,
    streaming: true,
    embeddings: true,
  };

  private client?: GoogleGenAI;
  private apiKey?: string;

  constructor(options?: GoogleAdapterOptions) {
    if (options?.client) {
      this.client = options.client;
    } else {
      this.apiKey = options?.apiKey;
    }
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = validateProviderCredentials('google', this.apiKey);
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  async completeStructured<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    const ai = this.getClient();
    const model = request.model || 'gemini-1.5-flash';

    const prompt = request.prompt;
    const systemInstruction = request.systemInstruction;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: request.temperature ?? 0,
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new InvalidModelOutputError('Google Gemini provider returned empty response text.');
      }

      let cleanedText = rawText;
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed: T;
      try {
        parsed = JSON.parse(cleanedText) as T;
      } catch (parseErr) {
        throw new InvalidModelOutputError(
          `Failed to parse JSON response from Google Gemini model: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          { cause: parseErr }
        );
      }

      const usage = response.usageMetadata;
      return {
        data: parsed,
        rawText,
        usage: usage
          ? {
              promptTokens: usage.promptTokenCount,
              completionTokens: usage.candidatesTokenCount,
              totalTokens: usage.totalTokenCount,
            }
          : undefined,
        finishStatus: 'stop',
        providerMeta: {
          modelVersion: model,
        },
      };
    } catch (error) {
      if (error instanceof InvalidModelOutputError || error instanceof ProviderError) {
        throw error;
      }
      throw new ModelUnavailableError(
        `Call to Google Gemini model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }
}

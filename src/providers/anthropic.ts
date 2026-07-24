import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProviderContract,
  ProviderCapabilityProfile,
  ProviderRequest,
  ProviderResponse,
} from './types.js';
import { validateProviderCredentials } from './config.js';
import { InvalidModelOutputError, ModelUnavailableError, ProviderError } from '../core/errors.js';

export interface AnthropicAdapterOptions {
  client?: Anthropic;
  apiKey?: string;
}

export class AnthropicProviderAdapter implements LLMProviderContract {
  readonly providerId = 'anthropic';
  readonly capabilities: ProviderCapabilityProfile = {
    structuredOutput: true,
    streaming: true,
    embeddings: false,
  };

  private client?: Anthropic;
  private apiKey?: string;

  constructor(options?: AnthropicAdapterOptions) {
    if (options?.client) {
      this.client = options.client;
    } else {
      this.apiKey = options?.apiKey;
    }
  }

  private getClient(): Anthropic {
    if (this.client) return this.client;
    const apiKey = validateProviderCredentials('anthropic', this.apiKey);
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  async completeStructured<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    const client = this.getClient();
    const model = request.model || 'claude-3-5-haiku-latest';

    // Construct prompt instructing Anthropic to respond strictly with valid JSON
    let system = request.systemInstruction || '';
    system +=
      '\n\nIMPORTANT: You must respond ONLY with a valid JSON object adhering to the expected schema. Do not include markdown codeblocks, prefix, or explanation.';

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        temperature: request.temperature ?? 0,
        system,
        messages: [{ role: 'user', content: request.prompt }],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || !textBlock.text) {
        throw new InvalidModelOutputError('Anthropic provider returned empty text response.');
      }

      let rawText = textBlock.text.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsed: T;
      try {
        parsed = JSON.parse(rawText) as T;
      } catch (parseErr) {
        throw new InvalidModelOutputError(
          `Failed to parse JSON response from Anthropic model: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          { cause: parseErr }
        );
      }

      return {
        data: parsed,
        rawText: textBlock.text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishStatus: response.stop_reason || 'stop',
        providerMeta: {
          id: response.id,
          model: response.model,
        },
      };
    } catch (error) {
      if (error instanceof InvalidModelOutputError || error instanceof ProviderError) {
        throw error;
      }
      throw new ModelUnavailableError(
        `Call to Anthropic model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }
}

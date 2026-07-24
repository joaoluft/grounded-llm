import OpenAI from 'openai';
import { LengthFinishReasonError, ContentFilterFinishReasonError } from 'openai/error.mjs';
import type {
  ChatCompletionParseParams,
  ParsedChatCompletion,
} from 'openai/resources/beta/chat/completions.mjs';
import type {
  LLMProviderContract,
  ProviderCapabilityProfile,
  ProviderRequest,
  ProviderResponse,
} from './types.js';
import { validateProviderCredentials } from './config.js';
import { InvalidModelOutputError, ModelUnavailableError, ProviderError } from '../core/errors.js';

export interface OpenAIAdapterOptions {
  client?: OpenAI;
  apiKey?: string;
}

export class OpenAIProviderAdapter implements LLMProviderContract {
  readonly providerId = 'openai';
  readonly capabilities: ProviderCapabilityProfile = {
    structuredOutput: true,
    streaming: true,
    embeddings: true,
  };

  private client: OpenAI;

  constructor(options?: OpenAIAdapterOptions) {
    if (options?.client) {
      this.client = options.client;
    } else {
      const apiKey = validateProviderCredentials('openai', options?.apiKey);
      this.client = new OpenAI({ apiKey });
    }
  }

  async completeStructured<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
    const messages: ChatCompletionParseParams['messages'] = [];

    if (request.systemInstruction) {
      messages.push({
        role: 'system',
        content: request.systemInstruction,
      });
    }

    messages.push({
      role: 'user',
      content: request.prompt,
    });

    const params: ChatCompletionParseParams = {
      model: request.model || 'gpt-4o-mini',
      messages,
      temperature: request.temperature ?? 0,
      response_format: request.schema as any,
    };

    let completion: ParsedChatCompletion<unknown>;
    try {
      completion = await this.client.beta.chat.completions.parse(params);
    } catch (error) {
      if (
        error instanceof LengthFinishReasonError ||
        error instanceof ContentFilterFinishReasonError
      ) {
        throw new InvalidModelOutputError(
          `Model response failed structured output validation: ${error.message}`,
          { cause: error }
        );
      }
      if (error instanceof InvalidModelOutputError || error instanceof ProviderError) {
        throw error;
      }
      throw new ModelUnavailableError(
        `Call to the OpenAI model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    const choice = completion.choices[0];
    const message = choice?.message;
    if (message?.refusal) {
      throw new InvalidModelOutputError(`Model refused to respond: ${message.refusal}`);
    }
    if (!message || message.parsed === null || message.parsed === undefined) {
      throw new InvalidModelOutputError(
        'Model response could not be parsed against the expected schema.'
      );
    }

    return {
      data: message.parsed as T,
      rawText: message.content ?? undefined,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      finishStatus: choice.finish_reason || 'stop',
      providerMeta: {
        id: completion.id,
        model: completion.model,
      },
    };
  }
}

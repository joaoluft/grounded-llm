import OpenAI from 'openai';
import { LengthFinishReasonError, ContentFilterFinishReasonError } from 'openai/error.mjs';
import type {
  ChatCompletionParseParams,
  ParsedChatCompletion,
} from 'openai/resources/beta/chat/completions.mjs';
import { ModelUnavailableError, InvalidModelOutputError } from './errors.js';

export type ParsedModelOutput = NonNullable<
  ParsedChatCompletion<unknown>['choices'][number]['message']['parsed']
>;

/**
 * Backend used by `GroundedCall.callModel` to actually reach a model. Two
 * implementations: `OpenAiModelClient` (native OpenAI client, the only backend
 * before 006-langchain-model-support) and `LangChainModelClient` (delegates to a
 * developer-supplied LangChain chat model, keeping LangSmith tracing intact).
 */
export interface ModelClient {
  parse(params: ChatCompletionParseParams): Promise<ParsedModelOutput>;
}

/** Extracted from `GroundedCall.callModel` verbatim (006-langchain-model-support) — no behavior change. */
export class OpenAiModelClient implements ModelClient {
  constructor(private readonly client: OpenAI) {}

  async parse(params: ChatCompletionParseParams): Promise<ParsedModelOutput> {
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
      throw new InvalidModelOutputError(
        'Model response could not be parsed against the expected schema.'
      );
    }
    return message.parsed;
  }
}

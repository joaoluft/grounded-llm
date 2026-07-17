import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import type { ChatCompletionParseParams } from 'openai/resources/beta/chat/completions.mjs';
import { ModelUnavailableError, InvalidModelOutputError } from './errors.js';
import type { ModelClient, ParsedModelOutput } from './model-client.js';

interface JsonSchemaResponseFormat {
  json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
}

function toLangChainMessages(messages: ChatCompletionMessageParam[]): [string, string][] {
  return messages.map((message) => [message.role, message.content as string]);
}

/**
 * Delegates model calls to a developer-supplied LangChain chat model instead of a
 * native OpenAI client, so calls keep flowing through the developer's own
 * LangChain/LangSmith tracing setup (006-langchain-model-support FR-002). Reuses the
 * JSON Schema already produced by `zodResponseFormat(...)` for the OpenAI path — no
 * separate schema definition is needed (research.md R1). No `@langchain/core` import
 * is required at runtime: messages are sent as plain `[role, content]` tuples
 * (research.md R2), and only the chat model instance the developer already
 * constructed is used.
 */
export class LangChainModelClient implements ModelClient {
  constructor(private readonly langchainModel: BaseChatModel) {}

  async parse(params: ChatCompletionParseParams): Promise<ParsedModelOutput> {
    const { json_schema } = params.response_format as unknown as JsonSchemaResponseFormat;
    const messages = toLangChainMessages(params.messages);

    let parsed: unknown;
    try {
      // `strict` must be forwarded, not just `schema`/`name`: without it, ChatOpenAI's
      // `method: "jsonSchema"` (the default for gpt-4o-family models) sends OpenAI a
      // `response_format.json_schema.strict` of `undefined`, which disables OpenAI's
      // actual Structured Outputs enforcement — the model then treats the schema as a
      // loose hint and can echo back the schema's own shape (e.g. `{ type, properties }`)
      // instead of conforming to it, instead of a guaranteed-conforming object.
      const structuredModel = this.langchainModel.withStructuredOutput(json_schema.schema, {
        name: json_schema.name,
        strict: json_schema.strict,
      });
      parsed = await structuredModel.invoke(messages);
    } catch (error) {
      throw new ModelUnavailableError(
        `Call to the LangChain chat model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    if (parsed === null || parsed === undefined) {
      throw new InvalidModelOutputError(
        'LangChain chat model response could not be parsed against the expected schema.'
      );
    }
    return parsed as ParsedModelOutput;
  }
}

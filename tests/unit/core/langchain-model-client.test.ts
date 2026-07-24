import { describe, it, expect, vi } from 'vitest';
import { LangChainModelClient } from '../../../src/core/langchain-model-client.js';
import { ModelUnavailableError, InvalidModelOutputError } from '../../../src/core/errors.js';

/**
 * Minimal fake compatible with the LangChain `BaseChatModel` surface this adapter
 * relies on: `withStructuredOutput(schema, opts).invoke(messages)`. No real
 * `@langchain/core` runtime behavior is exercised — only the shape our adapter reads.
 */
function makeFakeChatModel(options: { invoke?: (messages: unknown) => Promise<unknown> }) {
  const withStructuredOutput = vi.fn((_schema: unknown, _opts: unknown) => ({
    invoke: options.invoke ?? (async () => ({})),
  }));
  return { withStructuredOutput, model: { withStructuredOutput } as any };
}

const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'grounded_generation',
    strict: true,
    schema: { type: 'object', properties: { final_answer: { type: 'string' } } },
  },
};

const RESPONSE_FORMAT_NON_STRICT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'grounded_generation',
    strict: false,
    schema: { type: 'object', properties: { final_answer: { type: 'string' } } },
  },
};

const PARAMS = {
  model: 'ignored-in-langchain-mode',
  temperature: 0,
  response_format: RESPONSE_FORMAT,
  messages: [
    { role: 'system' as const, content: 'BASE INSTRUCTIONS' },
    { role: 'user' as const, content: 'What is the answer?' },
  ],
};

describe('LangChainModelClient (006-langchain-model-support, US1 happy path)', () => {
  it('extracts json_schema.schema/.name/.strict from response_format and passes them to withStructuredOutput', async () => {
    const fake = makeFakeChatModel({ invoke: async () => ({ final_answer: 'ok' }) });
    const client = new LangChainModelClient(fake.model);

    await client.parse(PARAMS as any);

    expect(fake.withStructuredOutput).toHaveBeenCalledWith(RESPONSE_FORMAT.json_schema.schema, {
      name: RESPONSE_FORMAT.json_schema.name,
      strict: RESPONSE_FORMAT.json_schema.strict,
    });
  });

  it('propagates strict: false as-is, instead of always forcing true', async () => {
    const fake = makeFakeChatModel({ invoke: async () => ({ final_answer: 'ok' }) });
    const client = new LangChainModelClient(fake.model);

    await client.parse({ ...PARAMS, response_format: RESPONSE_FORMAT_NON_STRICT } as any);

    expect(fake.withStructuredOutput).toHaveBeenCalledWith(
      RESPONSE_FORMAT_NON_STRICT.json_schema.schema,
      {
        name: RESPONSE_FORMAT_NON_STRICT.json_schema.name,
        strict: false,
      }
    );
  });

  it('converts messages into LangChain tuple format before invoking', async () => {
    let receivedMessages: unknown;
    const fake = makeFakeChatModel({
      invoke: async (messages) => {
        receivedMessages = messages;
        return { final_answer: 'ok' };
      },
    });
    const client = new LangChainModelClient(fake.model);

    await client.parse(PARAMS as any);

    expect(receivedMessages).toEqual([
      ['system', 'BASE INSTRUCTIONS'],
      ['user', 'What is the answer?'],
    ]);
  });

  it("returns whatever the fake's invoke resolved to as the parsed output", async () => {
    const fake = makeFakeChatModel({ invoke: async () => ({ final_answer: 'ok', extra: 1 }) });
    const client = new LangChainModelClient(fake.model);

    await expect(client.parse(PARAMS as any)).resolves.toEqual({ final_answer: 'ok', extra: 1 });
  });

  it('throws ModelUnavailableError when invoke rejects (US2, FR-007)', async () => {
    const fake = makeFakeChatModel({
      invoke: async () => {
        throw new Error('network down');
      },
    });
    const client = new LangChainModelClient(fake.model);

    await expect(client.parse(PARAMS as any)).rejects.toBeInstanceOf(ModelUnavailableError);
  });

  it('throws InvalidModelOutputError when invoke resolves with null (US2, FR-008)', async () => {
    const fake = makeFakeChatModel({ invoke: async () => null });
    const client = new LangChainModelClient(fake.model);

    await expect(client.parse(PARAMS as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it('throws InvalidModelOutputError when invoke resolves with undefined (US2, FR-008)', async () => {
    const fake = makeFakeChatModel({ invoke: async () => undefined });
    const client = new LangChainModelClient(fake.model);

    await expect(client.parse(PARAMS as any)).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
});

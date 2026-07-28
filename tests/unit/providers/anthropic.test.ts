import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProviderAdapter } from '../../../src/providers/anthropic.js';
import { InvalidModelOutputError, ModelUnavailableError } from '../../../src/core/errors.js';

const messagesCreateMock = vi.fn();
const anthropicCtor = vi.fn().mockImplementation(function () {
  return { messages: { create: messagesCreateMock } };
});

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: function (this: unknown, ...args: unknown[]) {
      return anthropicCtor(...args);
    },
  };
});

describe('AnthropicProviderAdapter unit/integration tests (US2)', () => {
  beforeEach(() => {
    anthropicCtor.mockClear();
    messagesCreateMock.mockReset();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('lazily constructs an Anthropic client from apiKey when no client is injected', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '{"ok": true}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({ apiKey: 'test-key' });

    await adapter.completeStructured({
      operation: 'completeStructured',
      model: 'claude-3-5-haiku-latest',
      prompt: 'test',
    });

    expect(anthropicCtor).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });

  it('strips a ```json fenced code block before parsing', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '```json\n{"ok": true}\n```' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    const response = await adapter.completeStructured<{ ok: boolean }>({
      operation: 'completeStructured',
      model: 'claude-3-5-haiku-latest',
      prompt: 'test',
    });

    expect(response.data).toEqual({ ok: true });
  });

  it('strips a plain ``` fenced code block before parsing', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '```\n{"ok": true}\n```' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    const response = await adapter.completeStructured<{ ok: boolean }>({
      operation: 'completeStructured',
      model: 'claude-3-5-haiku-latest',
      prompt: 'test',
    });

    expect(response.data).toEqual({ ok: true });
  });

  it('defaults to claude-3-5-haiku-latest when request.model is not provided', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '{"ok": true}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    await adapter.completeStructured({ operation: 'completeStructured', prompt: 'test' } as any);

    expect(messagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-haiku-latest' })
    );
  });

  it("defaults finishStatus to 'stop' when stop_reason is absent", async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: '{"ok": true}' }],
      stop_reason: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    const response = await adapter.completeStructured({
      operation: 'completeStructured',
      model: 'claude-3-5-haiku-latest',
      prompt: 'test',
    });

    expect(response.finishStatus).toBe('stop');
  });

  it('stringifies a non-Error JSON.parse failure into the InvalidModelOutputError message', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'text', text: 'irrelevant, JSON.parse is stubbed below' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'not-an-error-instance';
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'claude-3-5-haiku-latest',
        prompt: 'test',
      })
    ).rejects.toThrow('not-an-error-instance');
    parseSpy.mockRestore();
  });

  it('stringifies a non-Error client failure into the ModelUnavailableError message', async () => {
    messagesCreateMock.mockRejectedValue('connection reset');
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'claude-3-5-haiku-latest',
        prompt: 'test',
      })
    ).rejects.toThrow('connection reset');
  });

  it('throws InvalidModelOutputError when there is no text content block', async () => {
    messagesCreateMock.mockResolvedValue({
      id: 'msg_1',
      model: 'claude-3-5-haiku-latest',
      content: [{ type: 'image' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicProviderAdapter({
      client: { messages: { create: messagesCreateMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'claude-3-5-haiku-latest',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
  it('executes completeStructured with mocked Anthropic client successfully', async () => {
    const mockMessagesCreate = vi.fn().mockResolvedValue({
      id: 'msg_123',
      model: 'claude-3-5-haiku-latest',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '{"answer": "Grounded answer from Anthropic"}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 15 },
    });

    const mockClient = {
      messages: {
        create: mockMessagesCreate,
      },
    } as any;

    const adapter = new AnthropicProviderAdapter({ client: mockClient });
    const response = await adapter.completeStructured<{ answer: string }>({
      operation: 'completeStructured',
      model: 'claude-3-5-haiku-latest',
      prompt: 'What is 2+2?',
    });

    expect(response.data).toEqual({ answer: 'Grounded answer from Anthropic' });
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 15, totalTokens: 25 });
    expect(mockMessagesCreate).toHaveBeenCalled();
  });

  it('throws InvalidModelOutputError when Anthropic returns invalid JSON', async () => {
    const mockMessagesCreate = vi.fn().mockResolvedValue({
      id: 'msg_123',
      model: 'claude-3-5-haiku-latest',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'NOT VALID JSON' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 5 },
    });

    const mockClient = {
      messages: {
        create: mockMessagesCreate,
      },
    } as any;

    const adapter = new AnthropicProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'claude-3-5-haiku-latest',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it('throws ModelUnavailableError when client API call fails', async () => {
    const mockMessagesCreate = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockClient = {
      messages: {
        create: mockMessagesCreate,
      },
    } as any;

    const adapter = new AnthropicProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'claude-3-5-haiku-latest',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(ModelUnavailableError);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { AnthropicProviderAdapter } from '../../../src/providers/anthropic.js';
import { InvalidModelOutputError, ModelUnavailableError } from '../../../src/core/errors.js';

describe('AnthropicProviderAdapter unit/integration tests (US2)', () => {
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

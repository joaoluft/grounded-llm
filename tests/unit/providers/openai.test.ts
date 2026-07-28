import { describe, it, expect, vi } from 'vitest';
import { OpenAIProviderAdapter } from '../../../src/providers/openai.js';
import { InvalidModelOutputError, ProviderError } from '../../../src/core/errors.js';

describe('OpenAIProviderAdapter unit tests', () => {
  it('defaults to gpt-4o-mini when request.model is not provided', async () => {
    const parseMock = vi.fn().mockResolvedValue({
      id: 'chatcmpl_1',
      model: 'gpt-4o-mini',
      choices: [{ message: { refusal: null, parsed: { ok: true } }, finish_reason: 'stop' }],
    });
    const mockClient = { beta: { chat: { completions: { parse: parseMock } } } } as any;

    const adapter = new OpenAIProviderAdapter({ client: mockClient });
    await adapter.completeStructured({ operation: 'completeStructured', prompt: 'test' } as any);

    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini' }));
  });

  it('stringifies a non-Error client failure into the ModelUnavailableError message', async () => {
    const mockClient = {
      beta: { chat: { completions: { parse: vi.fn().mockRejectedValue('connection reset') } } },
    } as any;

    const adapter = new OpenAIProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gpt-4o-mini',
        prompt: 'test',
      })
    ).rejects.toThrow('connection reset');
  });

  it('rethrows an InvalidModelOutputError from parse() unchanged, without rewrapping', async () => {
    const original = new InvalidModelOutputError('already classified');
    const mockClient = {
      beta: { chat: { completions: { parse: vi.fn().mockRejectedValue(original) } } },
    } as any;

    const adapter = new OpenAIProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gpt-4o-mini',
        prompt: 'test',
      })
    ).rejects.toBe(original);
  });

  it('rethrows a ProviderError from parse() unchanged, without rewrapping', async () => {
    const original = new ProviderError('already classified', {
      category: 'auth',
      providerId: 'openai',
    });
    const mockClient = {
      beta: { chat: { completions: { parse: vi.fn().mockRejectedValue(original) } } },
    } as any;

    const adapter = new OpenAIProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gpt-4o-mini',
        prompt: 'test',
      })
    ).rejects.toBe(original);
  });
});

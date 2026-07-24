import { describe, it, expect, vi } from 'vitest';
import { GoogleProviderAdapter } from '../../../src/providers/google.js';
import { InvalidModelOutputError, ModelUnavailableError } from '../../../src/core/errors.js';

describe('GoogleProviderAdapter unit/integration tests (US2)', () => {
  it('executes completeStructured with mocked Google Gemini client successfully', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      text: '{"result": "Grounded answer from Gemini"}',
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 18,
        totalTokenCount: 30,
      },
    });

    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    } as any;

    const adapter = new GoogleProviderAdapter({ client: mockClient });
    const response = await adapter.completeStructured<{ result: string }>({
      operation: 'completeStructured',
      model: 'gemini-1.5-flash',
      prompt: 'Hello Gemini',
    });

    expect(response.data).toEqual({ result: 'Grounded answer from Gemini' });
    expect(response.usage).toEqual({ promptTokens: 12, completionTokens: 18, totalTokens: 30 });
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('throws InvalidModelOutputError when Google Gemini returns invalid JSON', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      text: 'PLAIN TEXT NON-JSON',
    });

    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    } as any;

    const adapter = new GoogleProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gemini-1.5-flash',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });

  it('throws ModelUnavailableError when client API call fails', async () => {
    const mockGenerateContent = vi.fn().mockRejectedValue(new Error('Google API Error'));
    const mockClient = {
      models: {
        generateContent: mockGenerateContent,
      },
    } as any;

    const adapter = new GoogleProviderAdapter({ client: mockClient });
    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gemini-1.5-flash',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(ModelUnavailableError);
  });
});

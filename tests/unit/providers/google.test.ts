import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleProviderAdapter } from '../../../src/providers/google.js';
import { InvalidModelOutputError, ModelUnavailableError } from '../../../src/core/errors.js';

const generateContentMock = vi.fn();
const googleGenAICtor = vi.fn().mockImplementation(function () {
  return { models: { generateContent: generateContentMock } };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: function (this: unknown, ...args: unknown[]) {
      return googleGenAICtor(...args);
    },
  };
});

describe('GoogleProviderAdapter unit/integration tests (US2)', () => {
  beforeEach(() => {
    googleGenAICtor.mockClear();
    generateContentMock.mockReset();
    delete process.env['GEMINI_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
  });

  it('lazily constructs a GoogleGenAI client from apiKey when no client is injected', async () => {
    generateContentMock.mockResolvedValue({ text: '{"result": "ok"}' });
    const adapter = new GoogleProviderAdapter({ apiKey: 'test-key' });

    await adapter.completeStructured({
      operation: 'completeStructured',
      model: 'gemini-1.5-flash',
      prompt: 'test',
    });

    expect(googleGenAICtor).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });

  it('strips a ```json fenced code block before parsing', async () => {
    generateContentMock.mockResolvedValue({ text: '```json\n{"result": "fenced"}\n```' });
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    const response = await adapter.completeStructured<{ result: string }>({
      operation: 'completeStructured',
      model: 'gemini-1.5-flash',
      prompt: 'test',
    });

    expect(response.data).toEqual({ result: 'fenced' });
  });

  it('strips a plain ``` fenced code block before parsing', async () => {
    generateContentMock.mockResolvedValue({ text: '```\n{"result": "fenced"}\n```' });
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    const response = await adapter.completeStructured<{ result: string }>({
      operation: 'completeStructured',
      model: 'gemini-1.5-flash',
      prompt: 'test',
    });

    expect(response.data).toEqual({ result: 'fenced' });
  });

  it('defaults to gemini-1.5-flash when request.model is not provided', async () => {
    generateContentMock.mockResolvedValue({ text: '{"result": "ok"}' });
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    await adapter.completeStructured({ operation: 'completeStructured', prompt: 'test' } as any);

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-flash' })
    );
  });

  it('stringifies a non-Error JSON.parse failure into the InvalidModelOutputError message', async () => {
    generateContentMock.mockResolvedValue({ text: 'irrelevant, JSON.parse is stubbed below' });
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'not-an-error-instance';
    });
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gemini-1.5-flash',
        prompt: 'test',
      })
    ).rejects.toThrow('not-an-error-instance');
    parseSpy.mockRestore();
  });

  it('stringifies a non-Error client failure into the ModelUnavailableError message', async () => {
    generateContentMock.mockRejectedValue('connection reset');
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gemini-1.5-flash',
        prompt: 'test',
      })
    ).rejects.toThrow('connection reset');
  });

  it('throws InvalidModelOutputError when the response text is empty', async () => {
    generateContentMock.mockResolvedValue({ text: '   ' });
    const adapter = new GoogleProviderAdapter({
      client: { models: { generateContent: generateContentMock } } as any,
    });

    await expect(
      adapter.completeStructured({
        operation: 'completeStructured',
        model: 'gemini-1.5-flash',
        prompt: 'test',
      })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
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

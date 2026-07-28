import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { APIConnectionError } from 'openai/error.mjs';
import { GroundedExtractor } from '../../../src/generators/grounded-extractor.js';
import {
  InvalidModelOutputError,
  ContextTooLargeError,
  ModelUnavailableError,
} from '../../../src/core/errors.js';

const parseMock = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        beta: { chat: { completions: { parse: parseMock } } },
      };
    }),
  };
});

function mockParsedResponse(parsed: unknown) {
  parseMock.mockResolvedValueOnce({
    choices: [{ message: { refusal: null, parsed } }],
  });
}

const fields = {
  name: z.string(),
  email: z.string(),
};
const fallbackValue = { name: null, email: null };

describe('GroundedExtractor langchainModel dispatch (006-langchain-model-support, US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('routes the call through a fake LangChain chat model instead of an OpenAI client', async () => {
    const invoke = vi.fn(async () => ({ name: 'Ada', email: null, reasoning: 'partial' }));
    const fakeModel = { withStructuredOutput: vi.fn(() => ({ invoke })) } as any;

    const extractor = new GroundedExtractor({ fields, langchainModel: fakeModel });
    const result = await extractor.extract({ message: 'My name is Ada' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(parseMock).not.toHaveBeenCalled();
    expect(result.data).toEqual({ name: 'Ada', email: null });
  });
});

describe('GroundedExtractor - construction/config validation (US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('throws immediately when fallbackValue is explicitly an empty object property set to an empty string', () => {
    expect(() => new GroundedExtractor({ fields, fallbackValue: '' as any })).toThrow(
      /fallbackValue/i
    );
  });

  it('throws immediately when fields is missing', () => {
    expect(() => new GroundedExtractor({ fallbackValue } as any)).toThrow(/fields/i);
  });

  it('defaults strict to false when omitted', async () => {
    mockParsedResponse({ name: 'Ada', email: null, reasoning: 'partial' });
    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: 'My name is Ada' });
    // non-strict (default) accepts partial data instead of falling back
    expect(result.usedFallback).toBe(false);
  });
});

describe('GroundedExtractor - full extraction success (US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns extracted data, reasoning, and temperature: 0 by default (FR-207, FR-208)', async () => {
    mockParsedResponse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      reasoning: 'both fields found',
    });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: "I'm Ada Lovelace, ada@example.com" });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(result.reasoning).toBeTruthy();
    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });

  it("includes the developer's identity/rules in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      reasoning: 'both fields found',
    });

    const extractor = new GroundedExtractor({
      fields,
      fallbackValue,
      identity: 'You are the support assistant for Acme Corp.',
      rules: 'Always respond in a formal tone.',
    });
    await extractor.extract({ message: "I'm Ada Lovelace, ada@example.com" });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('You are the support assistant for Acme Corp.');
    expect(sentSystemMessage).toContain('Always respond in a formal tone.');
    expect(sentSystemMessage.indexOf('You extract structured information')).toBeLessThan(
      sentSystemMessage.indexOf('You are the support assistant for Acme Corp.')
    );
  });
});

describe('GroundedExtractor - partial extraction, non-strict mode (default, US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns partial data with nulls for missing fields, no fallback', async () => {
    mockParsedResponse({ name: 'Ada Lovelace', email: null, reasoning: 'only name found' });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: "I'm Ada Lovelace" });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: 'Ada Lovelace', email: null });
  });
});

describe('GroundedExtractor - partial extraction, strict mode (US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('triggers the whole-object fallback instead of returning partial data', async () => {
    mockParsedResponse({ name: 'Ada Lovelace', email: null, reasoning: 'only name found' });

    const extractor = new GroundedExtractor({ fields, fallbackValue, strict: true });
    const result = await extractor.extract({ message: "I'm Ada Lovelace" });

    expect(result.usedFallback).toBe(true);
    expect(result.data).toEqual(fallbackValue);
  });
});

describe('GroundedExtractor - no extractable information (US2, FR-206)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns fallbackValue when every field is null', async () => {
    mockParsedResponse({ name: null, email: null, reasoning: 'nothing found' });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: 'The weather is nice today.' });

    expect(result.usedFallback).toBe(true);
    expect(result.data).toEqual(fallbackValue);
  });

  it('returns fallbackValue for an empty/blank message without calling the model', async () => {
    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: '   ' });

    expect(result.usedFallback).toBe(true);
    expect(result.data).toEqual(fallbackValue);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedExtractor - token usage metadata (issue #6)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('attaches provider-reported usage to the result on the success path', async () => {
    parseMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            refusal: null,
            parsed: { name: 'Ada Lovelace', email: 'ada@example.com', reasoning: 'both found' },
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 4, total_tokens: 19 },
    });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: "I'm Ada Lovelace, ada@example.com" });

    expect(result.usage).toEqual({ promptTokens: 15, completionTokens: 4, totalTokens: 19 });
  });

  it('attaches usage to a fallback result when the model was actually called', async () => {
    parseMock.mockResolvedValueOnce({
      choices: [
        { message: { refusal: null, parsed: { name: null, email: null, reasoning: 'nothing' } } },
      ],
      usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 },
    });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: 'The weather is nice today.' });

    expect(result.usedFallback).toBe(true);
    expect(result.usage).toEqual({ promptTokens: 9, completionTokens: 1, totalTokens: 10 });
  });

  it('leaves usage undefined when the short-circuit fallback never calls the model', async () => {
    const extractor = new GroundedExtractor({ fields, fallbackValue });
    const result = await extractor.extract({ message: '   ' });

    expect(result.usage).toBeUndefined();
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedExtractor - tone composition (004-behavioral-tone-field US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("includes the developer's tone in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      reasoning: 'both fields found',
    });

    const extractor = new GroundedExtractor({
      fields,
      fallbackValue,
      tone: 'Seja empático e gentil.',
    });
    await extractor.extract({ message: "I'm Ada Lovelace, ada@example.com" });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('Seja empático e gentil.');
    expect(sentSystemMessage.indexOf('You extract structured information')).toBeLessThan(
      sentSystemMessage.indexOf('Seja empático e gentil.')
    );
  });
});

describe('GroundedExtractor - free-extraction mode when no fallbackValue is configured (003-optional-fallback US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('constructs successfully without fallbackValue', () => {
    expect(() => new GroundedExtractor({ fields })).not.toThrow();
  });

  it('returns nulled-out data instead of throwing when nothing is extracted (FR-009)', async () => {
    mockParsedResponse({ name: null, email: null, reasoning: 'nothing found' });

    const extractor = new GroundedExtractor({ fields });
    const result = await extractor.extract({ message: 'The weather is nice today.' });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: null, email: null });
  });

  it('ignores strict and returns partial data instead of falling back (FR-009)', async () => {
    mockParsedResponse({ name: 'Ada Lovelace', email: null, reasoning: 'only name found' });

    const extractor = new GroundedExtractor({ fields, strict: true });
    const result = await extractor.extract({ message: "I'm Ada Lovelace" });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: 'Ada Lovelace', email: null });
  });

  it('returns nulled-out data for an empty/blank message without calling the model (FR-011)', async () => {
    const extractor = new GroundedExtractor({ fields });
    const result = await extractor.extract({ message: '   ' });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: null, email: null });
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedExtractor - malformed model output (defense-in-depth for the langchainModel path)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('throws InvalidModelOutputError, not silently-wrong data, when reasoning is missing', async () => {
    mockParsedResponse({ name: 'Ada Lovelace', email: null });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    await expect(extractor.extract({ message: "I'm Ada Lovelace" })).rejects.toBeInstanceOf(
      InvalidModelOutputError
    );
  });

  it('throws InvalidModelOutputError when a defined field comes back as a number instead of the expected type', async () => {
    mockParsedResponse({ name: 42, email: null, reasoning: 'r' });

    const extractor = new GroundedExtractor({ fields, fallbackValue });
    await expect(extractor.extract({ message: "I'm Ada Lovelace" })).rejects.toBeInstanceOf(
      InvalidModelOutputError
    );
  });
});

describe('GroundedExtractor - lifecycle callbacks: successful call (008-structured-logging-hooks US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('fires onCall and onResult with the GroundedExtractor.extract operation label and matching callId', async () => {
    mockParsedResponse({ name: 'Ada Lovelace', email: null, reasoning: 'r' });

    const onCall = vi.fn();
    const onResult = vi.fn();
    const extractor = new GroundedExtractor({ fields, fallbackValue, onCall, onResult });
    await extractor.extract({ message: "I'm Ada Lovelace" });

    expect(onCall.mock.calls[0][0].operation).toBe('GroundedExtractor.extract');
    expect(onCall.mock.calls[0][0].callId).toBe(onResult.mock.calls[0][0].callId);
    expect(onResult.mock.calls[0][0].usedFallback).toBe(false);
  });
});

describe('GroundedExtractor - lifecycle callbacks: failure classification (008-structured-logging-hooks US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("reports errorType 'invalid-output' when the model refuses to respond", async () => {
    parseMock.mockResolvedValueOnce({
      choices: [{ message: { refusal: 'cannot help', parsed: null } }],
    });
    const onError = vi.fn();
    const extractor = new GroundedExtractor({ fields, fallbackValue, onError });

    await expect(extractor.extract({ message: "I'm Ada Lovelace" })).rejects.toBeInstanceOf(
      InvalidModelOutputError
    );
    expect(onError.mock.calls[0][0].errorType).toBe('invalid-output');
  });

  it("reports errorType 'model-unavailable' when the provider call fails (issue #5)", async () => {
    parseMock.mockRejectedValueOnce(new APIConnectionError({ message: 'network down' }));
    const onError = vi.fn();
    const extractor = new GroundedExtractor({ fields, fallbackValue, onError });

    await expect(extractor.extract({ message: "I'm Ada Lovelace" })).rejects.toBeInstanceOf(
      ModelUnavailableError
    );
    expect(onError.mock.calls[0][0].errorType).toBe('model-unavailable');
  });

  it("reports errorType 'context-too-large' when the prompt exceeds maxContextTokens, without ever calling the model", async () => {
    const onError = vi.fn();
    const extractor = new GroundedExtractor({
      fields,
      fallbackValue,
      maxContextTokens: 1,
      onError,
    });

    await expect(extractor.extract({ message: 'a'.repeat(1000) })).rejects.toBeInstanceOf(
      ContextTooLargeError
    );
    expect(parseMock).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0].errorType).toBe('context-too-large');
  });
});

describe('GroundedExtractor - pluggable result cache (009-pluggable-result-cache, US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('serves an identical repeated request from the cache without a second model call', async () => {
    mockParsedResponse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      reasoning: 'both fields found',
    });
    const store = new Map<string, unknown>();
    const cache = {
      get: (k: string) => store.get(k),
      set: (k: string, v: unknown) => void store.set(k, v),
    };
    const extractor = new GroundedExtractor({ fields, fallbackValue, cache });

    const request = { message: "I'm Ada Lovelace, ada@example.com" };
    const first = await extractor.extract(request);
    const second = await extractor.extract(request);

    expect(second).toEqual(first);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it('never collides two instances that differ only in fallbackValue sharing the same cache', async () => {
    mockParsedResponse({ name: null, email: null, reasoning: 'nothing found' });
    mockParsedResponse({ name: null, email: null, reasoning: 'nothing found' });
    const store = new Map<string, unknown>();
    const cache = {
      get: (k: string) => store.get(k),
      set: (k: string, v: unknown) => void store.set(k, v),
    };

    const withFallback = new GroundedExtractor({ fields, fallbackValue, cache });
    const withoutFallback = new GroundedExtractor({ fields, cache });

    const request = { message: 'No relevant info here.' };
    const first = await withFallback.extract(request);
    const second = await withoutFallback.extract(request);

    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(first.usedFallback).toBe(true);
    expect(second.usedFallback).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { GroundedExtractor } from '../../../src/generators/grounded-extractor.js';

const parseMock = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
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

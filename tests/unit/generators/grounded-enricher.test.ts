import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedEnricher } from '../../../src/generators/grounded-enricher.js';
import { InvalidModelOutputError } from '../../../src/core/errors.js';

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

describe('GroundedEnricher langchainModel dispatch (006-langchain-model-support, US1)', () => {
  it('routes the call through a fake LangChain chat model instead of an OpenAI client', async () => {
    const invoke = vi.fn(async () => ({
      extracted_facts: ['Ships in 3 business days.'],
      sufficient_context: true,
      reasoning: 'The context adds shipping time.',
      enriched_text: 'Thanks for your order! Ships in 3 business days.',
    }));
    const fakeModel = { withStructuredOutput: vi.fn(() => ({ invoke })) } as any;

    const enricher = new GroundedEnricher({ langchainModel: fakeModel });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Ships in 3 business days.',
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(parseMock).not.toHaveBeenCalled();
    expect(result.finalAnswer).toBe('Thanks for your order! Ships in 3 business days.');
  });
});

describe('GroundedEnricher - sufficient-context happy path (US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns enriched text derived from baseContent + extracted facts when context is sufficient', async () => {
    mockParsedResponse({
      extracted_facts: ['Ships in 3 business days.'],
      sufficient_context: true,
      reasoning: 'The context adds shipping time.',
      enriched_text: 'Thanks for your order! Ships in 3 business days.',
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Ships in 3 business days.',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.extractedFacts).toEqual(['Ships in 3 business days.']);
    expect(result.finalAnswer).toBe('Thanks for your order! Ships in 3 business days.');
    expect(result.reasoning).toBeTruthy();
  });

  it('sends temperature: 0 to the client by default (FR-108)', async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      enriched_text: 'a',
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    await enricher.generate({ baseContent: 'base', context: 'fact' });

    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });

  it("includes the developer's identity/rules in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      enriched_text: 'a',
    });

    const enricher = new GroundedEnricher({
      fallbackValue: 'N/A',
      identity: 'You are the support assistant for Acme Corp.',
      rules: 'Always respond in a formal tone.',
    });
    await enricher.generate({ baseContent: 'base', context: 'fact' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('You are the support assistant for Acme Corp.');
    expect(sentSystemMessage).toContain('Always respond in a formal tone.');
    expect(sentSystemMessage.indexOf('You enrich a base piece of text')).toBeLessThan(
      sentSystemMessage.indexOf('You are the support assistant for Acme Corp.')
    );
  });
});

describe('GroundedEnricher - insufficient context returns baseContent unchanged (US1, FR-106)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns baseContent unchanged (not fallbackValue) when the model marks sufficient_context as false', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant information found.',
      enriched_text: '',
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Completely unrelated text.',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe('Thanks for your order!');
    expect(result.finalAnswer).not.toBe('N/A');
  });
});

describe('GroundedEnricher - empty/blank context (US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('short-circuits to baseContent unchanged on empty context, without calling the model', async () => {
    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: '   ',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe('Thanks for your order!');
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedEnricher - token usage metadata (issue #6)', () => {
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
            parsed: {
              extracted_facts: ['Ships in 3 business days.'],
              sufficient_context: true,
              reasoning: 'r',
              enriched_text: 'Thanks for your order! Ships in 3 business days.',
            },
          },
        },
      ],
      usage: { prompt_tokens: 30, completion_tokens: 6, total_tokens: 36 },
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Ships in 3 business days.',
    });

    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 6, totalTokens: 36 });
  });

  it('attaches usage to an unchanged (fallback) result when the model was actually called', async () => {
    parseMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            refusal: null,
            parsed: {
              extracted_facts: [],
              sufficient_context: false,
              reasoning: 'No relevant information found.',
              enriched_text: '',
            },
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 2, total_tokens: 14 },
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Completely unrelated text.',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 2, totalTokens: 14 });
  });

  it('leaves usage undefined when the short-circuit fallback never calls the model', async () => {
    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: '   ',
    });

    expect(result.usage).toBeUndefined();
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedEnricher - empty/blank baseContent is invalid usage (US1, FR-110)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('throws immediately for empty baseContent without calling the model', async () => {
    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    await expect(enricher.generate({ baseContent: '', context: 'some context' })).rejects.toThrow(
      /baseContent/i
    );
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('throws immediately for whitespace-only baseContent without calling the model', async () => {
    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    await expect(
      enricher.generate({ baseContent: '   ', context: 'some context' })
    ).rejects.toThrow(/baseContent/i);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedEnricher - tone composition (004-behavioral-tone-field US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("includes the developer's tone in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      enriched_text: 'a',
    });

    const enricher = new GroundedEnricher({
      fallbackValue: 'N/A',
      tone: 'Seja empático e gentil.',
    });
    await enricher.generate({ baseContent: 'base', context: 'fact' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('Seja empático e gentil.');
    expect(sentSystemMessage.indexOf('You enrich a base piece of text')).toBeLessThan(
      sentSystemMessage.indexOf('Seja empático e gentil.')
    );
  });
});

describe('GroundedEnricher - no fallbackValue configured (003-optional-fallback US2, FR-008)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('constructs successfully without fallbackValue', () => {
    expect(() => new GroundedEnricher({})).not.toThrow();
  });

  it('still returns baseContent unchanged when context is insufficient, with no fallbackValue configured', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant information found.',
      enriched_text: '',
    });

    const enricher = new GroundedEnricher({});
    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Completely unrelated text.',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe('Thanks for your order!');
  });
});

describe('GroundedEnricher - malformed model output (defense-in-depth for the langchainModel path)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('throws InvalidModelOutputError, not a raw TypeError, when extracted_facts is missing', async () => {
    mockParsedResponse({
      sufficient_context: true,
      reasoning: 'r',
      enriched_text: 'a',
    });

    const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
    await expect(
      enricher.generate({ baseContent: 'base', context: 'fact' })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
});

describe('GroundedEnricher - lifecycle callbacks: successful call (008-structured-logging-hooks US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('fires onCall and onResult with the GroundedEnricher.generate operation label and matching callId', async () => {
    mockParsedResponse({
      extracted_facts: ['Ships in 3 business days.'],
      sufficient_context: true,
      reasoning: 'The context adds shipping time.',
      enriched_text: 'Thanks for your order! Ships in 3 business days.',
    });

    const onCall = vi.fn();
    const onResult = vi.fn();
    const enricher = new GroundedEnricher({ fallbackValue: 'N/A', onCall, onResult });
    await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Ships in 3 business days.',
    });

    expect(onCall.mock.calls[0][0].operation).toBe('GroundedEnricher.generate');
    expect(onCall.mock.calls[0][0].callId).toBe(onResult.mock.calls[0][0].callId);
    expect(onResult.mock.calls[0][0].usedFallback).toBe(false);
  });
});

describe('GroundedEnricher - lifecycle callback isolation (008-structured-logging-hooks US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('does not let throwing callbacks affect the call result', async () => {
    mockParsedResponse({
      extracted_facts: ['Ships in 3 business days.'],
      sufficient_context: true,
      reasoning: 'r',
      enriched_text: 'Thanks for your order! Ships in 3 business days.',
    });

    const enricher = new GroundedEnricher({
      fallbackValue: 'N/A',
      onCall: () => {
        throw new Error('boom');
      },
      onResult: () => {
        throw new Error('boom');
      },
    });

    const result = await enricher.generate({
      baseContent: 'Thanks for your order!',
      context: 'Ships in 3 business days.',
    });
    expect(result.finalAnswer).toBe('Thanks for your order! Ships in 3 business days.');
  });
});

describe('GroundedEnricher - pluggable result cache (009-pluggable-result-cache, US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('serves an identical repeated request from the cache without a second model call', async () => {
    mockParsedResponse({
      extracted_facts: ['Ships in 3 business days.'],
      sufficient_context: true,
      reasoning: 'The context adds shipping time.',
      enriched_text: 'Thanks for your order! Ships in 3 business days.',
    });
    const store = new Map<string, unknown>();
    const cache = {
      get: (k: string) => store.get(k),
      set: (k: string, v: unknown) => void store.set(k, v),
    };
    const enricher = new GroundedEnricher({ cache });

    const request = { baseContent: 'Thanks for your order!', context: 'Ships in 3 business days.' };
    const first = await enricher.generate(request);
    const second = await enricher.generate(request);

    expect(second).toEqual(first);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });
});

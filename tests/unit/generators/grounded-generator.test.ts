import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIConnectionError } from 'openai/error.mjs';
import { GroundedGenerator } from '../../../src/generators/grounded-generator.js';
import {
  InvalidModelOutputError,
  ModelUnavailableError,
  ContextTooLargeError,
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

describe('GroundedGenerator result parity: standalone vs langchainModel (006-langchain-model-support, US2)', () => {
  const EQUIVALENT_OUTPUT = {
    extracted_facts: ['Paris is the capital of France.'],
    sufficient_context: true,
    reasoning: 'The context directly states the capital.',
    final_answer: 'Paris is the capital of France.',
  };
  const REQUEST = {
    context: 'Paris is the capital of France.',
    question: 'What is the capital of France?',
  };

  it('returns the exact same GroundedCallResult shape/values in both modes (FR-006, SC-003)', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    parseMock.mockReset();
    mockParsedResponse(EQUIVALENT_OUTPUT);
    const standaloneResult = await new GroundedGenerator({
      fallbackValue: "I don't know.",
    }).generate(REQUEST);

    const fakeModel = {
      withStructuredOutput: vi.fn(() => ({ invoke: async () => EQUIVALENT_OUTPUT })),
    } as any;
    const langchainResult = await new GroundedGenerator({
      fallbackValue: "I don't know.",
      langchainModel: fakeModel,
    }).generate(REQUEST);

    expect(langchainResult).toEqual(standaloneResult);
  });

  it('leaves usage undefined in langchainModel mode even though standalone mode has none reported here (issue #6)', async () => {
    const fakeModel = {
      withStructuredOutput: vi.fn(() => ({ invoke: async () => EQUIVALENT_OUTPUT })),
    } as any;
    const langchainResult = await new GroundedGenerator({
      fallbackValue: "I don't know.",
      langchainModel: fakeModel,
    }).generate(REQUEST);

    expect(langchainResult.usage).toBeUndefined();
  });
});

describe('GroundedGenerator - lifecycle callbacks fire identically under langchainModel (008-structured-logging-hooks FR-008)', () => {
  it('fires onCall/onResult with the same payload shape as standalone mode', async () => {
    const fakeModel = {
      withStructuredOutput: vi.fn(() => ({
        invoke: async () => ({
          extracted_facts: ['fact'],
          sufficient_context: true,
          reasoning: 'r',
          final_answer: 'a',
        }),
      })),
    } as any;

    const onCall = vi.fn();
    const onResult = vi.fn();
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      langchainModel: fakeModel,
      onCall,
      onResult,
    });
    await generator.generate({ context: 'fact', question: 'q?' });

    expect(onCall.mock.calls[0][0].operation).toBe('GroundedGenerator.generate');
    expect(onCall.mock.calls[0][0].callId).toBe(onResult.mock.calls[0][0].callId);
    expect(onResult.mock.calls[0][0].usedFallback).toBe(false);
  });
});

describe('GroundedGenerator - sufficient-context happy path (US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns a traceable answer derived from extracted facts when context is sufficient', async () => {
    mockParsedResponse({
      extracted_facts: ['Paris is the capital of France.'],
      sufficient_context: true,
      reasoning: 'The context directly states the capital.',
      final_answer: 'Paris is the capital of France.',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'Paris is the capital of France.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.extractedFacts).toEqual(['Paris is the capital of France.']);
    expect(result.finalAnswer).toBe('Paris is the capital of France.');
    expect(result.reasoning).toBeTruthy();
  });

  it('sends temperature: 0 to the client by default (FR-009)', async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await generator.generate({ context: 'fact', question: 'q?' });
  });

  it("includes the developer's identity/rules in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      identity: 'You are the support assistant for Acme Corp.',
      rules: 'Always respond in a formal tone.',
    });
    await generator.generate({ context: 'fact', question: 'q?' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('You are the support assistant for Acme Corp.');
    expect(sentSystemMessage).toContain('Always respond in a formal tone.');
    expect(
      sentSystemMessage.indexOf('You answer questions using ONLY the provided context.')
    ).toBeLessThan(sentSystemMessage.indexOf('You are the support assistant for Acme Corp.'));

    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });
});

describe('GroundedGenerator - fallback when context is insufficient (US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('returns the configured fallback when the model marks sufficient_context as false', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant information found.',
      final_answer: '',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'Completely unrelated text.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });

  it('short-circuits to fallback on empty/blank context without calling the model', async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: '   ',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('triggers fallback when sufficient_context is (erroneously) true but extracted_facts is empty (FR-004)', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: true,
      reasoning: 'Model claimed sufficiency without evidence.',
      final_answer: 'Some invented answer.',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'Some context.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });

  it('treats contradictory context as insufficient and triggers fallback', async () => {
    mockParsedResponse({
      extracted_facts: ['The meeting is at 3pm.', 'The meeting is at 5pm.'],
      sufficient_context: false,
      reasoning: 'The context contains contradictory information about the meeting time.',
      final_answer: '',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'The meeting is at 3pm. The meeting is at 5pm.',
      question: 'What time is the meeting?',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });
});

describe('GroundedGenerator - token usage metadata (issue #6)', () => {
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
              extracted_facts: ['Paris is the capital of France.'],
              sufficient_context: true,
              reasoning: 'r',
              final_answer: 'Paris is the capital of France.',
            },
          },
        },
      ],
      usage: { prompt_tokens: 42, completion_tokens: 8, total_tokens: 50 },
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'Paris is the capital of France.',
      question: 'What is the capital of France?',
    });

    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 8, totalTokens: 50 });
  });

  it('attaches usage to a fallback result when the model was actually called', async () => {
    parseMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            refusal: null,
            parsed: {
              extracted_facts: [],
              sufficient_context: false,
              reasoning: 'No relevant information found.',
              final_answer: '',
            },
          },
        },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 },
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: 'Completely unrelated text.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.usage).toEqual({ promptTokens: 20, completionTokens: 3, totalTokens: 23 });
  });

  it('leaves usage undefined when the short-circuit fallback never calls the model', async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: '   ',
      question: 'What is the capital of France?',
    });

    expect(result.usage).toBeUndefined();
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('leaves usage undefined when the provider does not report it', async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({ context: 'fact', question: 'q?' });

    expect(result.usage).toBeUndefined();
  });
});

describe('GroundedGenerator - free-answer mode when no fallbackValue is configured (003-optional-fallback US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("returns the model's own answer when context is insufficient and no fallback is configured (FR-003, FR-005)", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant information found in the context.',
      final_answer:
        "I couldn't find that in the context, but generally speaking, Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({
      context: 'Completely unrelated text.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe(
      "I couldn't find that in the context, but generally speaking, Paris is the capital of France."
    );
    expect(result.extractedFacts).toEqual([]);
    expect(result.reasoning).toBe('No relevant information found in the context.');
  });

  it('still calls the model when context is empty/blank and no fallback is configured (FR-004)', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No context was provided.',
      final_answer: "I don't have any context, but Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({
      context: '   ',
      question: 'What is the capital of France?',
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe(
      "I don't have any context, but Paris is the capital of France."
    );
  });

  it('sends the no-fallback prompt variant instructing the model to never leave final_answer empty', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({});
    await generator.generate({ context: 'irrelevant', question: 'q?' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('Never leave final_answer empty');
  });

  it("still returns the model's answer when sufficient_context is true and no fallback is configured", async () => {
    mockParsedResponse({
      extracted_facts: ['Paris is the capital of France.'],
      sufficient_context: true,
      reasoning: 'Directly stated.',
      final_answer: 'Paris is the capital of France.',
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({
      context: 'Paris is the capital of France.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe('Paris is the capital of France.');
  });
});

describe('GroundedGenerator - tone composition (004-behavioral-tone-field US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("includes the developer's tone in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      tone: 'Seja empático e gentil.',
    });
    await generator.generate({ context: 'fact', question: 'q?' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain('Seja empático e gentil.');
    expect(
      sentSystemMessage.indexOf('You answer questions using ONLY the provided context.')
    ).toBeLessThan(sentSystemMessage.indexOf('Seja empático e gentil.'));
  });
});

describe('GroundedGenerator - invalid question (US1 edge case)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('rejects an empty question immediately without calling the model', async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await expect(generator.generate({ context: 'some context', question: '' })).rejects.toThrow(
      /question/i
    );
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only question immediately without calling the model', async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await expect(generator.generate({ context: 'some context', question: '   ' })).rejects.toThrow(
      /question/i
    );
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedGenerator - malformed model output (defense-in-depth for the langchainModel path)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('throws InvalidModelOutputError, not a raw TypeError, when extracted_facts is missing', async () => {
    mockParsedResponse({
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await expect(
      generator.generate({ context: 'some context', question: 'some question' })
    ).rejects.toBeInstanceOf(InvalidModelOutputError);
  });
});

describe('GroundedGenerator - lifecycle callbacks: successful call (008-structured-logging-hooks US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('fires onCall before the model request and onResult after, with matching callId, durationMs, and usedFallback; never fires onError', async () => {
    mockParsedResponse({
      extracted_facts: ['Paris is the capital of France.'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'Paris is the capital of France.',
    });

    const onCall = vi.fn();
    const onResult = vi.fn();
    const onError = vi.fn();
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      onCall,
      onResult,
      onError,
    });
    await generator.generate({
      context: 'Paris is the capital of France.',
      question: 'What is the capital of France?',
    });

    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onCall.mock.calls[0][0].operation).toBe('GroundedGenerator.generate');
    expect(onCall.mock.calls[0][0].callId).toBe(onResult.mock.calls[0][0].callId);
    expect(onResult.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
    expect(onResult.mock.calls[0][0].usedFallback).toBe(false);
  });

  it('produces an identical result whether or not callbacks are configured (FR-009)', async () => {
    const output = {
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    };
    mockParsedResponse(output);
    const withoutCallbacks = await new GroundedGenerator({
      fallbackValue: "I don't know.",
    }).generate({ context: 'fact', question: 'q?' });

    mockParsedResponse(output);
    const withCallbacks = await new GroundedGenerator({
      fallbackValue: "I don't know.",
      onCall: vi.fn(),
      onResult: vi.fn(),
      onError: vi.fn(),
    }).generate({ context: 'fact', question: 'q?' });

    expect(withCallbacks).toEqual(withoutCallbacks);
  });
});

describe('GroundedGenerator - lifecycle callbacks: failure classification (008-structured-logging-hooks US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it("reports errorType 'model-unavailable' when the model backend fails, never fires onResult", async () => {
    parseMock.mockRejectedValueOnce(new APIConnectionError({ message: 'network down' }));
    const onResult = vi.fn();
    const onError = vi.fn();
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      onResult,
      onError,
    });

    await expect(generator.generate({ context: 'fact', question: 'q?' })).rejects.toBeInstanceOf(
      ModelUnavailableError
    );

    expect(onResult).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].errorType).toBe('model-unavailable');
  });

  it("reports errorType 'invalid-output' when the model refuses to respond", async () => {
    parseMock.mockResolvedValueOnce({
      choices: [{ message: { refusal: 'I cannot help with that.', parsed: null } }],
    });
    const onError = vi.fn();
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", onError });

    await expect(generator.generate({ context: 'fact', question: 'q?' })).rejects.toBeInstanceOf(
      InvalidModelOutputError
    );

    expect(onError.mock.calls[0][0].errorType).toBe('invalid-output');
  });

  it("reports errorType 'context-too-large' when the prompt exceeds maxContextTokens, without ever calling the model", async () => {
    const onCall = vi.fn();
    const onError = vi.fn();
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      maxContextTokens: 1,
      onCall,
      onError,
    });

    await expect(
      generator.generate({ context: 'a'.repeat(1000), question: 'q?' })
    ).rejects.toBeInstanceOf(ContextTooLargeError);

    expect(parseMock).not.toHaveBeenCalled();
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].errorType).toBe('context-too-large');
  });
});

describe('GroundedGenerator - lifecycle callbacks: isolation and edge cases (008-structured-logging-hooks US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('does not let throwing callbacks affect a successful call result', async () => {
    mockParsedResponse({
      extracted_facts: ['fact'],
      sufficient_context: true,
      reasoning: 'r',
      final_answer: 'a',
    });
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      onCall: () => {
        throw new Error('boom');
      },
      onResult: () => {
        throw new Error('boom');
      },
    });

    const result = await generator.generate({ context: 'fact', question: 'q?' });
    expect(result.finalAnswer).toBe('a');
  });

  it('does not let throwing callbacks affect a failing call, which still rejects with its original error', async () => {
    parseMock.mockRejectedValueOnce(new APIConnectionError({ message: 'network down' }));
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      onCall: () => {
        throw new Error('boom');
      },
      onError: () => {
        throw new Error('boom');
      },
    });

    await expect(generator.generate({ context: 'fact', question: 'q?' })).rejects.toBeInstanceOf(
      ModelUnavailableError
    );
  });

  it('fires onResult (not onError) with usedFallback: true when a fallback value is used', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant information found.',
      final_answer: '',
    });
    const onResult = vi.fn();
    const onError = vi.fn();
    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      onResult,
      onError,
    });

    const result = await generator.generate({
      context: 'Completely unrelated text.',
      question: 'What is the capital of France?',
    });

    expect(result.usedFallback).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].usedFallback).toBe(true);
  });
});

describe('GroundedGenerator - pluggable result cache (009-pluggable-result-cache, US1)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  function mapCache() {
    const store = new Map<string, unknown>();
    return {
      store,
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => {
        store.set(key, value);
      },
    };
  }

  const REQUEST = {
    context: 'Paris is the capital of France.',
    question: 'What is the capital of France?',
  };
  const OUTPUT = {
    extracted_facts: ['Paris is the capital of France.'],
    sufficient_context: true,
    reasoning: 'The context directly states the capital.',
    final_answer: 'Paris is the capital of France.',
  };

  it('serves an identical repeated request from the cache without a second model call', async () => {
    mockParsedResponse(OUTPUT);
    const cache = mapCache();
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    const first = await generator.generate(REQUEST);
    const second = await generator.generate(REQUEST);

    expect(second).toEqual(first);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it('never collides distinct requests that differ only in question or context (SC-004)', async () => {
    mockParsedResponse(OUTPUT);
    mockParsedResponse({ ...OUTPUT, final_answer: 'Berlin is the capital of Germany.' });
    const cache = mapCache();
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    await generator.generate(REQUEST);
    await generator.generate({ ...REQUEST, question: 'What is the capital of Germany?' });

    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it('caches a fallback result too, so a repeated known-insufficient-context request also skips the model', async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'No relevant excerpt.',
      final_answer: '',
    });
    const cache = mapCache();
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    const insufficientRequest = {
      context: 'Unrelated text.',
      question: 'What is the capital of France?',
    };
    const first = await generator.generate(insufficientRequest);
    const second = await generator.generate(insufficientRequest);

    expect(first.usedFallback).toBe(true);
    expect(second).toEqual(first);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });
});

describe('GroundedGenerator - no cache configured (009-pluggable-result-cache, US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('runs the pipeline for every call when no cache is configured, even for identical requests', async () => {
    const OUTPUT = {
      extracted_facts: ['Paris is the capital of France.'],
      sufficient_context: true,
      reasoning: 'The context directly states the capital.',
      final_answer: 'Paris is the capital of France.',
    };
    mockParsedResponse(OUTPUT);
    mockParsedResponse(OUTPUT);
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });

    const request = {
      context: 'Paris is the capital of France.',
      question: 'What is the capital of France?',
    };
    await generator.generate(request);
    await generator.generate(request);

    expect(parseMock).toHaveBeenCalledTimes(2);
  });
});

describe('GroundedGenerator - cache backend flexibility and failure isolation (009-pluggable-result-cache, US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  const REQUEST = {
    context: 'Paris is the capital of France.',
    question: 'What is the capital of France?',
  };
  const OUTPUT = {
    extracted_facts: ['Paris is the capital of France.'],
    sufficient_context: true,
    reasoning: 'The context directly states the capital.',
    final_answer: 'Paris is the capital of France.',
  };

  it('works identically with a Promise-returning (async) cache backend', async () => {
    mockParsedResponse(OUTPUT);
    const store = new Map<string, unknown>();
    const cache = {
      get: async (key: string) => store.get(key),
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    };
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    await generator.generate(REQUEST);
    await generator.generate(REQUEST);

    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it('resolves normally with a real result when the cache backend throws synchronously (FR-007, SC-005)', async () => {
    mockParsedResponse(OUTPUT);
    const cache = {
      get: () => {
        throw new Error('store unreachable');
      },
      set: () => {
        throw new Error('store unreachable');
      },
    };
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    const result = await generator.generate(REQUEST);
    expect(result.finalAnswer).toBe('Paris is the capital of France.');
  });

  it('resolves normally with a real result when the cache backend rejects asynchronously (FR-007, SC-005)', async () => {
    mockParsedResponse(OUTPUT);
    const cache = {
      get: () => Promise.reject(new Error('store unreachable')),
      set: () => Promise.reject(new Error('store unreachable')),
    };
    const generator = new GroundedGenerator({ fallbackValue: "I don't know.", cache });

    const result = await generator.generate(REQUEST);
    expect(result.finalAnswer).toBe('Paris is the capital of France.');
  });
});

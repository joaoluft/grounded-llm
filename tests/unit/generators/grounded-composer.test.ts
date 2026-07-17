import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedComposer } from '../../../src/generators/grounded-composer.js';

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

beforeEach(() => {
  parseMock.mockReset();
  process.env['OPENAI_API_KEY'] = 'test-key';
});

describe('GroundedComposer - happy path with instructions only (US1)', () => {
  it('returns a final message derived from instructions when no context is given', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol, offering the listed options.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'Instructions require asking for the protocol.',
      final_message: 'Entendi, e qual protocolo devo usar?',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({
      instructions: 'Ask for the protocol, offering the listed options.',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe('Entendi, e qual protocolo devo usar?');
    expect(result.extractedFacts).toEqual(['Ask for the protocol, offering the listed options.']);
    expect(result.reasoning).toBeTruthy();
  });

  it('sends temperature: 0 to the client by default', async () => {
    mockParsedResponse({
      applied_rules: ['rule'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'r',
      final_message: 'a',
    });

    const composer = new GroundedComposer({});
    await composer.compose({ instructions: 'rule' });

    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });
});

describe('GroundedComposer - never abstains (US1, FR-705)', () => {
  it.each([
    { applied_rules: ['r1'], final_message: 'm1' },
    { applied_rules: ['r2a', 'r2b'], final_message: 'm2' },
    { applied_rules: ['r3'], final_message: 'm3' },
  ])('always returns a non-empty finalAnswer with usedFallback false (%#)', async (fixture) => {
    mockParsedResponse({
      applied_rules: fixture.applied_rules,
      context_used: false,
      context_excerpts: [],
      reasoning: 'r',
      final_message: fixture.final_message,
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({ instructions: 'some instructions' });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe(fixture.final_message);
    expect(result.finalAnswer.length).toBeGreaterThan(0);
  });
});

describe('GroundedComposer - empty/blank instructions is invalid usage (US1, FR-703)', () => {
  it('throws immediately for empty instructions without calling the model', async () => {
    const composer = new GroundedComposer({});
    await expect(composer.compose({ instructions: '' })).rejects.toThrow(/instructions/i);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it('throws immediately for whitespace-only instructions without calling the model', async () => {
    const composer = new GroundedComposer({});
    await expect(composer.compose({ instructions: '   ' })).rejects.toThrow(/instructions/i);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe('GroundedComposer - ignores any configured fallbackValue (US1)', () => {
  it('never returns the configured fallbackValue and usedFallback stays false', async () => {
    mockParsedResponse({
      applied_rules: ['rule'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'r',
      final_message: 'composed message',
    });

    const composer = new GroundedComposer({ fallbackValue: 'SHOULD_NEVER_APPEAR' });
    const result = await composer.compose({ instructions: 'rule' });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe('composed message');
    expect(result.finalAnswer).not.toBe('SHOULD_NEVER_APPEAR');
  });
});

describe('GroundedComposer - context used when relevant (US2)', () => {
  it('includes context excerpts in extractedFacts and reflects the conflict in reasoning', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol.'],
      context_used: true,
      context_excerpts: ['Customer asked about a Toyota vehicle.'],
      reasoning:
        'Customer mentioned an unsupported brand; addressing it before asking for the protocol.',
      final_message:
        'Não trabalhamos com Toyota, mas seguimos com seu atendimento — qual protocolo?',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({
      instructions: 'Ask for the protocol.',
      context: 'Customer asked about a Toyota vehicle.',
    });

    expect(result.extractedFacts).toEqual([
      'Ask for the protocol.',
      'Customer asked about a Toyota vehicle.',
    ]);
    expect(result.reasoning).toContain('unsupported brand');
  });
});

describe('GroundedComposer - context present but irrelevant (US2)', () => {
  it('does not include context excerpts in extractedFacts when context_used is false', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'Context has nothing relevant to this question.',
      final_message: 'Entendi, e qual protocolo devo usar?',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({
      instructions: 'Ask for the protocol.',
      context: 'Weather is nice today.',
    });

    expect(result.extractedFacts).toEqual(['Ask for the protocol.']);
    expect(result.finalAnswer).toBe('Entendi, e qual protocolo devo usar?');
  });
});

describe('GroundedComposer - context absent/empty/blank (US2, FR-704)', () => {
  it('proceeds normally (still calls the model) when context is undefined', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'No conversation data provided.',
      final_message: 'Entendi, e qual protocolo devo usar?',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({ instructions: 'Ask for the protocol.' });

    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe('Entendi, e qual protocolo devo usar?');
  });

  it('proceeds normally when context is empty/blank', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'No conversation data provided.',
      final_message: 'Entendi, e qual protocolo devo usar?',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({
      instructions: 'Ask for the protocol.',
      context: '   ',
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(false);
  });
});

describe('GroundedComposer - traceability (US3)', () => {
  it('extractedFacts (from applied_rules) is never empty', async () => {
    mockParsedResponse({
      applied_rules: ['Ask for the protocol.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'r',
      final_message: 'm',
    });

    const composer = new GroundedComposer({});
    const result = await composer.compose({ instructions: 'Ask for the protocol.' });

    expect(result.extractedFacts.length).toBeGreaterThan(0);
  });

  it("includes the developer's identity/rules/tone in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      applied_rules: ['rule'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'r',
      final_message: 'a',
    });

    const composer = new GroundedComposer({
      identity: 'You are the support assistant for Acme Corp.',
      rules: 'Always respond in a formal tone.',
      tone: 'Seja empático e gentil.',
    });
    await composer.compose({ instructions: 'rule' });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    const builtInIndex = sentSystemMessage.indexOf('You compose a final message');
    const identityIndex = sentSystemMessage.indexOf('You are the support assistant for Acme Corp.');
    const rulesIndex = sentSystemMessage.indexOf('Always respond in a formal tone.');
    const toneIndex = sentSystemMessage.indexOf('Seja empático e gentil.');

    expect(builtInIndex).toBeGreaterThanOrEqual(0);
    expect(identityIndex).toBeGreaterThan(builtInIndex);
    expect(rulesIndex).toBeGreaterThan(identityIndex);
    expect(toneIndex).toBeGreaterThan(rulesIndex);
  });
});

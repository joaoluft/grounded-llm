import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedGenerator } from '../../../src/index.js';
import type { GroundedCallConfig } from '../../../src/index.js';

const parseMock = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

/** Simulates a pipeline (e.g. a LangGraph-style node) that already produces plain context/question strings. */
function stubRetrievalPipelineNode(question: string): { context: string; question: string } {
  return { context: 'Retrieved context produced by an external pipeline.', question };
}

describe('GroundedGenerator - pluggable into any pipeline without third-party types (US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it('accepts plain context/question strings from a pipeline-produced retrieval step, no third-party types required', async () => {
    parseMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            refusal: null,
            parsed: {
              extracted_facts: ['Retrieved context produced by an external pipeline.'],
              sufficient_context: true,
              reasoning: 'Directly relevant.',
              final_answer: 'Here is the answer.',
            },
          },
        },
      ],
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const request = stubRetrievalPipelineNode('What was retrieved?');
    const result = await generator.generate(request);

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe('Here is the answer.');
  });

  it('uses a pre-configured openai client instance injected via config.client instead of creating one internally (FR-008, Acceptance Scenario 2)', async () => {
    const injectedParse = vi.fn().mockResolvedValueOnce({
      choices: [
        {
          message: {
            refusal: null,
            parsed: {
              extracted_facts: ['fact'],
              sufficient_context: true,
              reasoning: 'r',
              final_answer: 'a',
            },
          },
        },
      ],
    });
    const injectedClient = { beta: { chat: { completions: { parse: injectedParse } } } } as any;

    const config: GroundedCallConfig = { fallbackValue: "I don't know.", client: injectedClient };
    const generator = new GroundedGenerator(config);
    await generator.generate({ context: 'fact', question: 'q?' });

    expect(injectedParse).toHaveBeenCalledTimes(1);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

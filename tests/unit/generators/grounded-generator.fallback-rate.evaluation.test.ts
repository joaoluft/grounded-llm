import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedGenerator } from '../../../src/generators/grounded-generator.js';

const parseMock = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

type Case = {
  label: string;
  context: string;
  question: string;
  /** Mocked model response for cases that do reach the model (omit for empty/blank short-circuit cases). */
  mockedOutput?: {
    extracted_facts: string[];
    sufficient_context: boolean;
    reasoning: string;
    final_answer: string;
  };
};

// SC-001: on a fixed evaluation set of questions whose context is known to be insufficient,
// the component MUST return the configured fallback in at least 95% of cases.
const CASES: Case[] = [
  { label: 'empty-1', context: '', question: 'What is the capital of France?' },
  { label: 'empty-2', context: '   ', question: 'Who wrote Hamlet?' },
  { label: 'empty-3', context: '\n\t', question: 'What year did WWII end?' },
  { label: 'empty-4', context: '', question: 'What is the speed of light?' },
  { label: 'empty-5', context: '  ', question: 'Who is the CEO of Acme Corp?' },

  ...[
    'Bananas are a good source of potassium.',
    'The stock market closed higher today.',
    'Photosynthesis converts sunlight into energy.',
    'The Eiffel Tower is in Paris.',
    'Cats are obligate carnivores.',
  ].map((context, i) => ({
    label: `off-topic-${i + 1}`,
    context,
    question: 'What is the capital of Germany?',
    mockedOutput: {
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'The context does not mention the capital of Germany.',
      final_answer: '',
    },
  })),

  ...[
    'The company was founded in 2010 and is based in Berlin.',
    'The product launched last year to positive reviews.',
    'The team includes engineers from several countries.',
    'The report covers financial performance for Q1.',
    'The conference will be held in the fall.',
  ].map((context, i) => ({
    label: `partially-related-${i + 1}`,
    context,
    question: 'Who is the current CEO of the company?',
    mockedOutput: {
      extracted_facts: [context],
      sufficient_context: false,
      reasoning: 'The context is related to the company but does not name a CEO.',
      final_answer: '',
    },
  })),

  ...[
    ['The meeting is at 3pm.', 'The meeting is at 5pm.'],
    ['The store closes at 9pm.', 'The store closes at 10pm.'],
    ['The library opens on Sundays.', 'The library is closed on Sundays.'],
    ['The refund policy is 30 days.', 'The refund policy is 14 days.'],
    ['The flight departs at noon.', 'The flight departs at 1pm.'],
  ].map((facts, i) => ({
    label: `contradictory-${i + 1}`,
    context: facts.join(' '),
    question: 'What is the correct time/policy?',
    mockedOutput: {
      extracted_facts: facts,
      sufficient_context: false,
      reasoning: 'The context contains contradictory information about the same fact.',
      final_answer: '',
    },
  })),
];

describe('SC-001: fallback rate on insufficient-context evaluation set', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it(`returns fallback for at least 95% of ${CASES.length} known-insufficient cases`, async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);

    let fallbackCount = 0;
    for (const testCase of CASES) {
      if (testCase.mockedOutput) {
        parseMock.mockResolvedValueOnce({
          choices: [{ message: { refusal: null, parsed: testCase.mockedOutput } }],
        });
      }
      const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
      const result = await generator.generate({
        context: testCase.context,
        question: testCase.question,
      });
      if (result.usedFallback) fallbackCount += 1;
    }

    const rate = fallbackCount / CASES.length;
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

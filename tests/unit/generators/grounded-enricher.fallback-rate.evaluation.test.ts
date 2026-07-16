import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedEnricher } from '../../../src/generators/grounded-enricher.js';

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
  baseContent: string;
  context: string;
  mockedOutput?: {
    extracted_facts: string[];
    sufficient_context: boolean;
    reasoning: string;
    enriched_text: string;
  };
};

// SC-102: on a fixed evaluation set of insufficient-context enrichments, GroundedEnricher
// MUST return baseContent unchanged (usedFallback = true) in >= 95% of cases.
const CASES: Case[] = [
  { label: 'empty-1', baseContent: 'Thanks for your order!', context: '' },
  { label: 'empty-2', baseContent: 'Welcome aboard.', context: '   ' },
  { label: 'empty-3', baseContent: 'Your request was received.', context: '\n\t' },
  { label: 'empty-4', baseContent: 'Here is your summary.', context: '' },
  { label: 'empty-5', baseContent: 'See you soon.', context: '  ' },

  ...[
    'Bananas are a good source of potassium.',
    'The stock market closed higher today.',
    'Photosynthesis converts sunlight into energy.',
    'The Eiffel Tower is in Paris.',
    'Cats are obligate carnivores.',
  ].map((context, i) => ({
    label: `off-topic-${i + 1}`,
    baseContent: 'Thanks for contacting support.',
    context,
    mockedOutput: {
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'The context is unrelated to the base text.',
      enriched_text: '',
    },
  })),

  ...[
    'The company was founded in 2010 and is based in Berlin.',
    'The product launched last year to positive reviews.',
    'The team includes engineers from several countries.',
    'The report covers financial performance for Q1.',
    'The conference will be held in the fall.',
  ].map((context, i) => ({
    label: `unrelated-${i + 1}`,
    baseContent: 'Your account has been updated.',
    context,
    mockedOutput: {
      extracted_facts: [],
      sufficient_context: false,
      reasoning: 'The context does not add relevant information to the base text.',
      enriched_text: '',
    },
  })),

  ...[
    'Meeting moved to 3pm. Meeting moved to 5pm.',
    'Store closes at 9pm. Store closes at 10pm.',
    'Library opens Sundays. Library closed Sundays.',
    'Refund policy is 30 days. Refund policy is 14 days.',
    'Flight departs at noon. Flight departs at 1pm.',
  ].map((context, i) => ({
    label: `contradictory-${i + 1}`,
    baseContent: 'Here is an update.',
    context,
    mockedOutput: {
      extracted_facts: [context],
      sufficient_context: false,
      reasoning: 'The context contains contradictory information.',
      enriched_text: '',
    },
  })),
];

describe('SC-102: baseContent-unchanged rate on insufficient-context evaluation set', () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env['OPENAI_API_KEY'] = 'test-key';
  });

  it(`returns baseContent unchanged for at least 95% of ${CASES.length} known-insufficient cases`, async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);

    let unchangedCount = 0;
    for (const testCase of CASES) {
      if (testCase.mockedOutput) {
        parseMock.mockResolvedValueOnce({
          choices: [{ message: { refusal: null, parsed: testCase.mockedOutput } }],
        });
      }
      const enricher = new GroundedEnricher({ fallbackValue: 'N/A' });
      const result = await enricher.generate({
        baseContent: testCase.baseContent,
        context: testCase.context,
      });
      if (result.usedFallback && result.finalAnswer === testCase.baseContent) unchangedCount += 1;
    }

    const rate = unchangedCount / CASES.length;
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { GroundedExtractor } from "../../../src/generators/GroundedExtractor.js";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

const fields = { name: z.string(), email: z.string() };
const fallbackValue = { name: null, email: null };

type Case = {
  label: string;
  message: string;
  mockedOutput?: { name: null; email: null; reasoning: string };
};

// SC-104: on a fixed evaluation set of messages with no extractable information,
// GroundedExtractor MUST return fallbackValue (usedFallback = true) in >= 95% of cases.
const CASES: Case[] = [
  { label: "empty-1", message: "" },
  { label: "empty-2", message: "   " },
  { label: "empty-3", message: "\n\t" },
  { label: "empty-4", message: "" },
  { label: "empty-5", message: "  " },

  ...["What time does the store open?", "The weather is nice today.",
      "I really enjoyed the movie last night.", "Can you tell me a joke?",
      "The stock market closed higher today.", "I'm just browsing, thanks.",
      "What's the capital of France?", "Do you sell umbrellas?",
      "The train was delayed by 10 minutes.", "I like hiking on weekends.",
      "Is the office open on holidays?", "The coffee here is great.",
      "What's your return policy?", "I forgot what I was going to say.",
      "Traffic was bad this morning."].map((message, i) => ({
    label: `off-topic-${i + 1}`,
    message,
    mockedOutput: { name: null, email: null, reasoning: "No name or email mentioned in the message." },
  })),
];

describe("SC-104: fallback rate on no-extractable-information evaluation set", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it(`returns fallbackValue for at least 95% of ${CASES.length} known-empty cases`, async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);

    let fallbackCount = 0;
    for (const testCase of CASES) {
      if (testCase.mockedOutput) {
        parseMock.mockResolvedValueOnce({
          choices: [{ message: { refusal: null, parsed: testCase.mockedOutput } }],
        });
      }
      const extractor = new GroundedExtractor({ fields, fallbackValue });
      const result = await extractor.extract({ message: testCase.message });
      if (result.usedFallback && JSON.stringify(result.data) === JSON.stringify(fallbackValue)) {
        fallbackCount += 1;
      }
    }

    const rate = fallbackCount / CASES.length;
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});

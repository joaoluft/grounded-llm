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

const fields = { name: z.string(), email: z.string(), intent: z.string() };
const fallbackValue = { name: null, email: null, intent: null };

type Case = {
  label: string;
  message: string;
  partialOutput: { name: string | null; email: string | null; intent: string | null; reasoning: string };
};

// SC-106: on a fixed evaluation set of partial-coverage messages, non-strict mode
// MUST return partial data (no fallback) in 100% of cases, and strict mode MUST
// trigger fallbackValue in 100% of the same cases.
const CASES: Case[] = Array.from({ length: 20 }, (_, i) => ({
  label: `partial-${i + 1}`,
  message: `Hi, I'm User${i}, I have a question.`,
  partialOutput: {
    name: `User${i}`,
    email: null,
    intent: null,
    reasoning: "Only the name was mentioned in the message.",
  },
}));

describe("SC-106: strict vs non-strict behavior on partial extraction", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it(`non-strict mode returns partial data (no fallback) for 100% of ${CASES.length} partial-coverage cases`, async () => {
    let partialCount = 0;
    for (const testCase of CASES) {
      parseMock.mockResolvedValueOnce({
        choices: [{ message: { refusal: null, parsed: testCase.partialOutput } }],
      });
      const extractor = new GroundedExtractor({ fields, fallbackValue, strict: false });
      const result = await extractor.extract({ message: testCase.message });
      if (!result.usedFallback && result.data.name === testCase.partialOutput.name && result.data.email === null) {
        partialCount += 1;
      }
    }
    expect(partialCount / CASES.length).toBe(1);
  });

  it(`strict mode triggers fallbackValue for 100% of the same ${CASES.length} partial-coverage cases`, async () => {
    let fallbackCount = 0;
    for (const testCase of CASES) {
      parseMock.mockResolvedValueOnce({
        choices: [{ message: { refusal: null, parsed: testCase.partialOutput } }],
      });
      const extractor = new GroundedExtractor({ fields, fallbackValue, strict: true });
      const result = await extractor.extract({ message: testCase.message });
      if (result.usedFallback && JSON.stringify(result.data) === JSON.stringify(fallbackValue)) {
        fallbackCount += 1;
      }
    }
    expect(fallbackCount / CASES.length).toBe(1);
  });
});

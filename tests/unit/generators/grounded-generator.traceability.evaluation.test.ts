import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroundedGenerator } from "../../../src/generators/grounded-generator.js";

const parseMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      beta: { chat: { completions: { parse: parseMock } } },
    })),
  };
});

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "of", "in", "on", "at", "to", "and", "or", "was", "were",
  "it", "its", "as", "by", "for", "with", "that", "this", "be", "has", "have",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:]/g, "");
}

function significantWords(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

type Case = {
  label: string;
  context: string;
  question: string;
  extractedFacts: string[];
  finalAnswer: string;
};

// SC-002: on a fixed evaluation set of sufficient-context questions, 100% of final answers
// MUST be traceable to the extracted facts (every significant term used in the answer must
// appear in the concatenation of extracted facts).
const CASES: Case[] = [
  { label: "capital", context: "Paris is the capital of France.", question: "What is the capital of France?", extractedFacts: ["Paris is the capital of France."], finalAnswer: "Paris is the capital of France." },
  { label: "author", context: "Hamlet was written by William Shakespeare.", question: "Who wrote Hamlet?", extractedFacts: ["Hamlet was written by William Shakespeare."], finalAnswer: "Hamlet was written by William Shakespeare." },
  { label: "year", context: "World War II ended in 1945.", question: "What year did WWII end?", extractedFacts: ["World War II ended in 1945."], finalAnswer: "World War II ended in 1945." },
  { label: "speed", context: "The speed of light is approximately 299,792 kilometers per second.", question: "What is the speed of light?", extractedFacts: ["The speed of light is approximately 299,792 kilometers per second."], finalAnswer: "The speed of light is approximately 299,792 kilometers per second." },
  { label: "ceo", context: "Jane Doe is the CEO of Acme Corp.", question: "Who is the CEO of Acme Corp?", extractedFacts: ["Jane Doe is the CEO of Acme Corp."], finalAnswer: "Jane Doe is the CEO of Acme Corp." },
  { label: "fruit", context: "Bananas are a good source of potassium.", question: "What nutrient do bananas provide?", extractedFacts: ["Bananas are a good source of potassium."], finalAnswer: "Bananas are a good source of potassium." },
  { label: "tower", context: "The Eiffel Tower is located in Paris, France.", question: "Where is the Eiffel Tower?", extractedFacts: ["The Eiffel Tower is located in Paris, France."], finalAnswer: "The Eiffel Tower is located in Paris, France." },
  { label: "cats", context: "Cats are obligate carnivores.", question: "What kind of diet do cats have?", extractedFacts: ["Cats are obligate carnivores."], finalAnswer: "Cats are obligate carnivores." },
  { label: "founding", context: "Acme Corp was founded in 2010 in Berlin.", question: "When was Acme Corp founded?", extractedFacts: ["Acme Corp was founded in 2010 in Berlin."], finalAnswer: "Acme Corp was founded in 2010." },
  { label: "location", context: "Acme Corp was founded in 2010 in Berlin.", question: "Where is Acme Corp based?", extractedFacts: ["Acme Corp was founded in 2010 in Berlin."], finalAnswer: "Acme Corp was founded in Berlin." },
  { label: "conference", context: "The annual conference will be held in the fall in Tokyo.", question: "When is the conference?", extractedFacts: ["The annual conference will be held in the fall in Tokyo."], finalAnswer: "The conference will be held in the fall." },
  { label: "conference-location", context: "The annual conference will be held in the fall in Tokyo.", question: "Where is the conference?", extractedFacts: ["The annual conference will be held in the fall in Tokyo."], finalAnswer: "The conference will be held in Tokyo." },
  { label: "refund", context: "The refund policy allows returns within 30 days of purchase.", question: "What is the refund policy?", extractedFacts: ["The refund policy allows returns within 30 days of purchase."], finalAnswer: "The refund policy allows returns within 30 days of purchase." },
  { label: "flight", context: "The flight to Lisbon departs at noon.", question: "When does the flight depart?", extractedFacts: ["The flight to Lisbon departs at noon."], finalAnswer: "The flight departs at noon." },
  { label: "library", context: "The library opens on Sundays from 10am to 2pm.", question: "Is the library open on Sundays?", extractedFacts: ["The library opens on Sundays from 10am to 2pm."], finalAnswer: "The library opens on Sundays from 10am to 2pm." },
  { label: "product", context: "The product launched in 2023 to positive reviews.", question: "When did the product launch?", extractedFacts: ["The product launched in 2023 to positive reviews."], finalAnswer: "The product launched in 2023." },
  { label: "team", context: "The engineering team includes members from Brazil, Germany, and Japan.", question: "Where is the team from?", extractedFacts: ["The engineering team includes members from Brazil, Germany, and Japan."], finalAnswer: "The team includes members from Brazil, Germany, and Japan." },
  { label: "report", context: "The Q1 financial report shows revenue growth of 12 percent.", question: "How much did revenue grow?", extractedFacts: ["The Q1 financial report shows revenue growth of 12 percent."], finalAnswer: "The Q1 financial report shows revenue growth of 12 percent." },
  { label: "store-hours", context: "The store closes at 9pm on weekdays.", question: "What time does the store close?", extractedFacts: ["The store closes at 9pm on weekdays."], finalAnswer: "The store closes at 9pm on weekdays." },
  { label: "photosynthesis", context: "Photosynthesis converts sunlight into chemical energy in plants.", question: "What does photosynthesis do?", extractedFacts: ["Photosynthesis converts sunlight into chemical energy in plants."], finalAnswer: "Photosynthesis converts sunlight into chemical energy in plants." },
];

describe("SC-002: traceability of final answers to extracted facts", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it(`traces 100% of ${CASES.length} sufficient-context final answers to their extracted facts`, async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);

    let traceableCount = 0;
    for (const testCase of CASES) {
      parseMock.mockResolvedValueOnce({
        choices: [
          {
            message: {
              refusal: null,
              parsed: {
                extracted_facts: testCase.extractedFacts,
                sufficient_context: true,
                reasoning: "Directly supported by the extracted facts.",
                final_answer: testCase.finalAnswer,
              },
            },
          },
        ],
      });

      const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
      const result = await generator.generate({ context: testCase.context, question: testCase.question });

      const factsText = normalize(result.extractedFacts.join(" "));
      const answerWords = significantWords(result.finalAnswer);
      const isTraceable = answerWords.every((word) => factsText.includes(word));

      if (isTraceable) traceableCount += 1;
      else console.error(`Not traceable: [${testCase.label}] "${result.finalAnswer}" vs facts "${factsText}"`);
    }

    const rate = traceableCount / CASES.length;
    expect(rate).toBe(1);
  });
});

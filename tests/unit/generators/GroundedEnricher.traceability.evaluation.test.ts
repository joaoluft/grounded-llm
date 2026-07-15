import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroundedEnricher } from "../../../src/generators/GroundedEnricher.js";

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
  "it", "its", "as", "by", "for", "with", "that", "this", "be", "has", "have", "your",
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
  baseContent: string;
  context: string;
  extractedFacts: string[];
  enrichedText: string;
};

// SC-101: on a fixed evaluation set of sufficient-context enrichments, 100% of enriched
// texts MUST be traceable to baseContent + extractedFacts.
const CASES: Case[] = [
  { label: "shipping", baseContent: "Thanks for your order!", context: "Ships in 3 business days.", extractedFacts: ["Ships in 3 business days."], enrichedText: "Thanks for your order! Ships in 3 business days." },
  { label: "capital", baseContent: "France is a country in Europe.", context: "Paris is the capital of France.", extractedFacts: ["Paris is the capital of France."], enrichedText: "France is a country in Europe. Paris is the capital of France." },
  { label: "author", baseContent: "Hamlet is a famous play.", context: "Hamlet was written by William Shakespeare.", extractedFacts: ["Hamlet was written by William Shakespeare."], enrichedText: "Hamlet is a famous play. Hamlet was written by William Shakespeare." },
  { label: "founding", baseContent: "Acme Corp is a technology company.", context: "Acme Corp was founded in 2010 in Berlin.", extractedFacts: ["Acme Corp was founded in 2010 in Berlin."], enrichedText: "Acme Corp is a technology company. Acme Corp was founded in 2010 in Berlin." },
  { label: "refund", baseContent: "We value our customers.", context: "The refund policy allows returns within 30 days of purchase.", extractedFacts: ["The refund policy allows returns within 30 days of purchase."], enrichedText: "We value our customers. The refund policy allows returns within 30 days of purchase." },
  { label: "flight", baseContent: "Your trip is confirmed.", context: "The flight to Lisbon departs at noon.", extractedFacts: ["The flight to Lisbon departs at noon."], enrichedText: "Your trip is confirmed. The flight to Lisbon departs at noon." },
  { label: "library", baseContent: "Welcome to the community center.", context: "The library opens on Sundays from 10am to 2pm.", extractedFacts: ["The library opens on Sundays from 10am to 2pm."], enrichedText: "Welcome to the community center. The library opens on Sundays from 10am to 2pm." },
  { label: "product", baseContent: "Check out our latest release.", context: "The product launched in 2023 to positive reviews.", extractedFacts: ["The product launched in 2023 to positive reviews."], enrichedText: "Check out our latest release. The product launched in 2023 to positive reviews." },
  { label: "team", baseContent: "Meet our engineering team.", context: "The engineering team includes members from Brazil, Germany, and Japan.", extractedFacts: ["The engineering team includes members from Brazil, Germany, and Japan."], enrichedText: "Meet our engineering team. The engineering team includes members from Brazil, Germany, and Japan." },
  { label: "report", baseContent: "Our quarterly update is here.", context: "The Q1 financial report shows revenue growth of 12 percent.", extractedFacts: ["The Q1 financial report shows revenue growth of 12 percent."], enrichedText: "Our quarterly update is here. The Q1 financial report shows revenue growth of 12 percent." },
  { label: "store-hours", baseContent: "Visit us in store.", context: "The store closes at 9pm on weekdays.", extractedFacts: ["The store closes at 9pm on weekdays."], enrichedText: "Visit us in store. The store closes at 9pm on weekdays." },
  { label: "photosynthesis", baseContent: "Plants are fascinating.", context: "Photosynthesis converts sunlight into chemical energy in plants.", extractedFacts: ["Photosynthesis converts sunlight into chemical energy in plants."], enrichedText: "Plants are fascinating. Photosynthesis converts sunlight into chemical energy in plants." },
  { label: "conference", baseContent: "Save the date.", context: "The annual conference will be held in the fall in Tokyo.", extractedFacts: ["The annual conference will be held in the fall in Tokyo."], enrichedText: "Save the date. The annual conference will be held in the fall in Tokyo." },
  { label: "speed", baseContent: "Physics is full of constants.", context: "The speed of light is approximately 299792 kilometers per second.", extractedFacts: ["The speed of light is approximately 299792 kilometers per second."], enrichedText: "Physics is full of constants. The speed of light is approximately 299792 kilometers per second." },
  { label: "cats", baseContent: "We love pets.", context: "Cats are obligate carnivores.", extractedFacts: ["Cats are obligate carnivores."], enrichedText: "We love pets. Cats are obligate carnivores." },
  { label: "tower", baseContent: "Paris is a popular destination.", context: "The Eiffel Tower is located in Paris, France.", extractedFacts: ["The Eiffel Tower is located in Paris, France."], enrichedText: "Paris is a popular destination. The Eiffel Tower is located in Paris, France." },
  { label: "fruit", baseContent: "Eat your fruits and vegetables.", context: "Bananas are a good source of potassium.", extractedFacts: ["Bananas are a good source of potassium."], enrichedText: "Eat your fruits and vegetables. Bananas are a good source of potassium." },
  { label: "market", baseContent: "Here is today's summary.", context: "The stock market closed higher today.", extractedFacts: ["The stock market closed higher today."], enrichedText: "Here is today's summary. The stock market closed higher today." },
  { label: "ceo", baseContent: "Acme Corp is growing fast.", context: "Jane Doe is the CEO of Acme Corp.", extractedFacts: ["Jane Doe is the CEO of Acme Corp."], enrichedText: "Acme Corp is growing fast. Jane Doe is the CEO of Acme Corp." },
  { label: "year", baseContent: "History has many turning points.", context: "World War II ended in 1945.", extractedFacts: ["World War II ended in 1945."], enrichedText: "History has many turning points. World War II ended in 1945." },
];

describe("SC-101: traceability of enriched text to baseContent + extractedFacts", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it(`traces 100% of ${CASES.length} sufficient-context enrichments to baseContent + extractedFacts`, async () => {
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
                enriched_text: testCase.enrichedText,
              },
            },
          },
        ],
      });

      const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
      const result = await enricher.generate({ baseContent: testCase.baseContent, context: testCase.context });

      const allowedText = normalize(`${testCase.baseContent} ${result.extractedFacts.join(" ")}`);
      const answerWords = significantWords(result.finalAnswer);
      const isTraceable = answerWords.every((word) => allowedText.includes(word));

      if (isTraceable) traceableCount += 1;
      else console.error(`Not traceable: [${testCase.label}] "${result.finalAnswer}" vs "${allowedText}"`);
    }

    const rate = traceableCount / CASES.length;
    expect(rate).toBe(1);
  });
});

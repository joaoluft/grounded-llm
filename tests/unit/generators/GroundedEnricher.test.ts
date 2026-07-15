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

function mockParsedResponse(parsed: unknown) {
  parseMock.mockResolvedValueOnce({
    choices: [{ message: { refusal: null, parsed } }],
  });
}

describe("GroundedEnricher - sufficient-context happy path (US1)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns enriched text derived from baseContent + extracted facts when context is sufficient", async () => {
    mockParsedResponse({
      extracted_facts: ["Ships in 3 business days."],
      sufficient_context: true,
      reasoning: "The context adds shipping time.",
      enriched_text: "Thanks for your order! Ships in 3 business days.",
    });

    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    const result = await enricher.generate({
      baseContent: "Thanks for your order!",
      context: "Ships in 3 business days.",
    });

    expect(result.usedFallback).toBe(false);
    expect(result.extractedFacts).toEqual(["Ships in 3 business days."]);
    expect(result.finalAnswer).toBe("Thanks for your order! Ships in 3 business days.");
    expect(result.reasoning).toBeTruthy();
  });

  it("sends temperature: 0 to the client by default (FR-108)", async () => {
    mockParsedResponse({
      extracted_facts: ["fact"],
      sufficient_context: true,
      reasoning: "r",
      enriched_text: "a",
    });

    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    await enricher.generate({ baseContent: "base", context: "fact" });

    expect(parseMock).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0 }));
  });
});

describe("GroundedEnricher - insufficient context returns baseContent unchanged (US1, FR-106)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns baseContent unchanged (not fallbackValue) when the model marks sufficient_context as false", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found.",
      enriched_text: "",
    });

    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    const result = await enricher.generate({
      baseContent: "Thanks for your order!",
      context: "Completely unrelated text.",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("Thanks for your order!");
    expect(result.finalAnswer).not.toBe("N/A");
  });
});

describe("GroundedEnricher - empty/blank context (US1)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("short-circuits to baseContent unchanged on empty context, without calling the model", async () => {
    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    const result = await enricher.generate({ baseContent: "Thanks for your order!", context: "   " });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("Thanks for your order!");
    expect(parseMock).not.toHaveBeenCalled();
  });
});

describe("GroundedEnricher - empty/blank baseContent is invalid usage (US1, FR-110)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("throws immediately for empty baseContent without calling the model", async () => {
    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    await expect(
      enricher.generate({ baseContent: "", context: "some context" })
    ).rejects.toThrow(/baseContent/i);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("throws immediately for whitespace-only baseContent without calling the model", async () => {
    const enricher = new GroundedEnricher({ fallbackValue: "N/A" });
    await expect(
      enricher.generate({ baseContent: "   ", context: "some context" })
    ).rejects.toThrow(/baseContent/i);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

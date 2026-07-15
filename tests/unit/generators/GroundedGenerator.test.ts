import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroundedGenerator } from "../../../src/generators/GroundedGenerator.js";

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

describe("GroundedGenerator - sufficient-context happy path (US1)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns a traceable answer derived from extracted facts when context is sufficient", async () => {
    mockParsedResponse({
      extracted_facts: ["Paris is the capital of France."],
      sufficient_context: true,
      reasoning: "The context directly states the capital.",
      final_answer: "Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: "Paris is the capital of France.",
      question: "What is the capital of France?",
    });

    expect(result.usedFallback).toBe(false);
    expect(result.extractedFacts).toEqual(["Paris is the capital of France."]);
    expect(result.finalAnswer).toBe("Paris is the capital of France.");
    expect(result.reasoning).toBeTruthy();
  });

  it("sends temperature: 0 to the client by default (FR-009)", async () => {
    mockParsedResponse({
      extracted_facts: ["fact"],
      sufficient_context: true,
      reasoning: "r",
      final_answer: "a",
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await generator.generate({ context: "fact", question: "q?" });
  });

  it("includes the developer's identity/rules in the system message, after the built-in instructions", async () => {
    mockParsedResponse({
      extracted_facts: ["fact"],
      sufficient_context: true,
      reasoning: "r",
      final_answer: "a",
    });

    const generator = new GroundedGenerator({
      fallbackValue: "I don't know.",
      identity: "You are the support assistant for Acme Corp.",
      rules: "Always respond in a formal tone.",
    });
    await generator.generate({ context: "fact", question: "q?" });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain("You are the support assistant for Acme Corp.");
    expect(sentSystemMessage).toContain("Always respond in a formal tone.");
    expect(sentSystemMessage.indexOf("You answer questions using ONLY the provided context.")).toBeLessThan(
      sentSystemMessage.indexOf("You are the support assistant for Acme Corp.")
    );

    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 })
    );
  });
});

describe("GroundedGenerator - fallback when context is insufficient (US2)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns the configured fallback when the model marks sufficient_context as false", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found.",
      final_answer: "",
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: "Completely unrelated text.",
      question: "What is the capital of France?",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });

  it("short-circuits to fallback on empty/blank context without calling the model", async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({ context: "   ", question: "What is the capital of France?" });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("triggers fallback when sufficient_context is (erroneously) true but extracted_facts is empty (FR-004)", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: true,
      reasoning: "Model claimed sufficiency without evidence.",
      final_answer: "Some invented answer.",
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: "Some context.",
      question: "What is the capital of France?",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });

  it("treats contradictory context as insufficient and triggers fallback", async () => {
    mockParsedResponse({
      extracted_facts: ["The meeting is at 3pm.", "The meeting is at 5pm."],
      sufficient_context: false,
      reasoning: "The context contains contradictory information about the meeting time.",
      final_answer: "",
    });

    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    const result = await generator.generate({
      context: "The meeting is at 3pm. The meeting is at 5pm.",
      question: "What time is the meeting?",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("I don't know.");
  });
});

describe("GroundedGenerator - invalid question (US1 edge case)", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("rejects an empty question immediately without calling the model", async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await expect(
      generator.generate({ context: "some context", question: "" })
    ).rejects.toThrow(/question/i);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only question immediately without calling the model", async () => {
    const generator = new GroundedGenerator({ fallbackValue: "I don't know." });
    await expect(
      generator.generate({ context: "some context", question: "   " })
    ).rejects.toThrow(/question/i);
    expect(parseMock).not.toHaveBeenCalled();
  });
});

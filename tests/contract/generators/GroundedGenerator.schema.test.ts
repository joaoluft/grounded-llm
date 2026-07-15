import { describe, it, expect } from "vitest";
import { groundedGenerationSchema } from "../../../src/generators/schema.js";

describe("GroundedGenerator structured output schema", () => {
  it("accepts a fully-formed sufficient-context payload", () => {
    const result = groundedGenerationSchema.safeParse({
      extracted_facts: ["The sky is blue."],
      sufficient_context: true,
      reasoning: "The context directly states the sky's color.",
      final_answer: "The sky is blue.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully-formed insufficient-context payload with empty facts", () => {
    const result = groundedGenerationSchema.safeParse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found in the context.",
      final_answer: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing sufficient_context", () => {
    const result = groundedGenerationSchema.safeParse({
      extracted_facts: [],
      reasoning: "x",
      final_answer: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with a non-boolean sufficient_context", () => {
    const result = groundedGenerationSchema.safeParse({
      extracted_facts: [],
      sufficient_context: "true",
      reasoning: "x",
      final_answer: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with non-string entries in extracted_facts", () => {
    const result = groundedGenerationSchema.safeParse({
      extracted_facts: [123],
      sufficient_context: true,
      reasoning: "x",
      final_answer: "x",
    });
    expect(result.success).toBe(false);
  });

  it("converts to a strict JSON Schema response_format via zodResponseFormat", async () => {
    const { zodResponseFormat } = await import("openai/helpers/zod.mjs");
    const format = zodResponseFormat(groundedGenerationSchema, "grounded_generation");
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.name).toBe("grounded_generation");
  });
});

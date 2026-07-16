import { describe, it, expect } from "vitest";
import { groundedEnrichmentSchema } from "../../../src/generators/grounded-enricher.schema.js";

describe("GroundedEnricher structured output schema", () => {
  it("accepts a fully-formed sufficient-context payload", () => {
    const result = groundedEnrichmentSchema.safeParse({
      extracted_facts: ["The product ships in 3 business days."],
      sufficient_context: true,
      reasoning: "The context adds shipping time information.",
      enriched_text: "Thanks for your order! It ships in 3 business days.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully-formed insufficient-context payload with empty facts", () => {
    const result = groundedEnrichmentSchema.safeParse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found in the context.",
      enriched_text: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing sufficient_context", () => {
    const result = groundedEnrichmentSchema.safeParse({
      extracted_facts: [],
      reasoning: "x",
      enriched_text: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with non-string entries in extracted_facts", () => {
    const result = groundedEnrichmentSchema.safeParse({
      extracted_facts: [123],
      sufficient_context: true,
      reasoning: "x",
      enriched_text: "x",
    });
    expect(result.success).toBe(false);
  });

  it("converts to a strict JSON Schema response_format via zodResponseFormat", async () => {
    const { zodResponseFormat } = await import("openai/helpers/zod.mjs");
    const format = zodResponseFormat(groundedEnrichmentSchema, "grounded_enrichment");
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.name).toBe("grounded_enrichment");
  });
});

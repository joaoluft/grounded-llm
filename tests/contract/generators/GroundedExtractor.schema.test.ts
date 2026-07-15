import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildExtractionSchema } from "../../../src/generators/GroundedExtractor.schema.js";

describe("GroundedExtractor dynamically-built structured output schema", () => {
  const fields = {
    name: z.string(),
    email: z.string(),
  };

  it("makes every developer-provided field nullable", () => {
    const { schema } = buildExtractionSchema(fields);
    const result = schema.safeParse({ name: null, email: null, reasoning: "nothing found" });
    expect(result.success).toBe(true);
  });

  it("still accepts non-null values for developer-provided fields", () => {
    const { schema } = buildExtractionSchema(fields);
    const result = schema.safeParse({ name: "Ada", email: null, reasoning: "found only name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ada");
      expect(result.data.email).toBeNull();
    }
  });

  it("adds a required reasoning field", () => {
    const { schema } = buildExtractionSchema(fields);
    const result = schema.safeParse({ name: null, email: null });
    expect(result.success).toBe(false);
  });

  it("produces a strict JSON Schema response_format via zodResponseFormat", () => {
    const { responseFormat } = buildExtractionSchema(fields);
    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.strict).toBe(true);
  });
});

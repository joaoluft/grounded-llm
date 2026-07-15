import { z } from "zod";

/**
 * Structured output schema for GroundedGenerator's single model call: literal fact
 * extraction, an explicit sufficiency decision, and the grounded answer (FR-001,
 * FR-002, FR-003). Field names match the raw model output (snake_case); see
 * data-model.md for the mapping to the public `GroundedCallResult` fields.
 */
export const groundedGenerationSchema = z.object({
  extracted_facts: z.array(z.string()),
  sufficient_context: z.boolean(),
  reasoning: z.string(),
  final_answer: z.string(),
});

export type GroundedGenerationOutput = z.infer<typeof groundedGenerationSchema>;

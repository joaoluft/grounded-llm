import { z } from "zod";

/**
 * Structured output schema for GroundedEnricher's single model call: literal fact
 * extraction from `context`, an explicit sufficiency decision, and the enriched text
 * (FR-102, FR-103, FR-104). `enriched_text` (not `final_answer`) names the model's
 * own output field, per research.md's field-naming decision — the public
 * `GroundedCallResult.finalAnswer` mapping is done by `GroundedEnricher`.
 */
export const groundedEnrichmentSchema = z.object({
  extracted_facts: z.array(z.string()),
  sufficient_context: z.boolean(),
  reasoning: z.string(),
  enriched_text: z.string(),
});

export type GroundedEnrichmentOutput = z.infer<typeof groundedEnrichmentSchema>;

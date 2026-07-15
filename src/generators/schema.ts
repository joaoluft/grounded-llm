import { z } from "zod";

/**
 * Structured output schema for GroundedGenerator's single model call: literal fact
 * extraction, an explicit sufficiency decision, and the grounded answer (FR-001,
 * FR-002, FR-003). Field names match the raw model output (snake_case); see
 * data-model.md for the mapping to the public `GroundedCallResult` fields.
 */
export const groundedGenerationSchema = z.object({
  extracted_facts: z
    .array(z.string())
    .describe("Trechos literais extraídos do contexto fornecido que sustentam a resposta."),
  sufficient_context: z
    .boolean()
    .describe(
      "Se o contexto fornecido é suficiente para responder com segurança, sem completar com conhecimento externo."
    ),
  reasoning: z
    .string()
    .describe("Raciocínio conectando os trechos extraídos à decisão de suficiência e à resposta final."),
  final_answer: z
    .string()
    .describe("Resposta final ao usuário, derivada exclusivamente dos trechos extraídos."),
});

export type GroundedGenerationOutput = z.infer<typeof groundedGenerationSchema>;

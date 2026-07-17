import { z } from 'zod';

/**
 * Structured output schema for GroundedComposer's single model call: literal
 * extraction from `instructions` (the mandatory anchor), an explicit signal of
 * whether `context` influenced the message, and the composed message. Unlike
 * GroundedGenerator/GroundedEnricher, there is no sufficiency gate — `final_message`
 * is always populated.
 */
export const groundedCompositionSchema = z.object({
  applied_rules: z
    .array(z.string())
    .describe(
      'Trechos literais das instructions que determinam a mensagem a ser gerada (nunca vazio).'
    ),
  context_used: z
    .boolean()
    .describe(
      'Se algo do context (conflito, progresso, dado a referenciar) influenciou a mensagem final.'
    ),
  context_excerpts: z
    .array(z.string())
    .describe(
      'Trechos literais do context que sustentam context_used. Vazio quando context_used é false.'
    ),
  reasoning: z
    .string()
    .describe(
      'Raciocínio conectando as instructions aplicadas (e o context usado, quando houver) à mensagem final.'
    ),
  final_message: z
    .string()
    .describe('Mensagem final composta a partir das instructions, sempre preenchida.'),
});

export type GroundedCompositionOutput = z.infer<typeof groundedCompositionSchema>;

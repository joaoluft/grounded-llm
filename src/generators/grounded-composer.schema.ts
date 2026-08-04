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
  context_excerpts: z
    .array(z.string())
    .describe(
      'Trechos literais do context potencialmente relevantes, extraídos antes de decidir se serão usados.'
    ),
  reasoning: z
    .string()
    .describe(
      'Raciocínio conectando as instructions aplicadas (e os context_excerpts, quando relevantes) à decisão de context_used e à mensagem final. Deve ser escrito antes de decidir context_used, não depois.'
    ),
  context_used: z
    .boolean()
    .describe(
      'Se algo do context (conflito, progresso, dado a referenciar) influenciou a mensagem final.'
    ),
  final_message: z
    .string()
    .describe('Mensagem final composta a partir das instructions, sempre preenchida.'),
});

export type GroundedCompositionOutput = z.infer<typeof groundedCompositionSchema>;

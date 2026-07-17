import { describe, it, expect } from 'vitest';
import { groundedCompositionSchema } from '../../../src/generators/grounded-composer.schema.js';

describe('GroundedComposer structured output schema', () => {
  it('accepts a fully-formed payload with context used', () => {
    const result = groundedCompositionSchema.safeParse({
      applied_rules: ['Ask for the customer name.'],
      context_used: true,
      context_excerpts: ['Customer already mentioned wanting a Renault.'],
      reasoning: 'The instructions require asking for the name; context adds prior brand mention.',
      final_message: 'Perfeito, e qual é o seu nome?',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully-formed payload with context not used and empty excerpts', () => {
    const result = groundedCompositionSchema.safeParse({
      applied_rules: ['Ask for the customer name.'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'No relevant conversation data available.',
      final_message: 'Perfeito, e qual é o seu nome?',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing applied_rules', () => {
    const result = groundedCompositionSchema.safeParse({
      context_used: false,
      context_excerpts: [],
      reasoning: 'x',
      final_message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing context_used', () => {
    const result = groundedCompositionSchema.safeParse({
      applied_rules: ['x'],
      context_excerpts: [],
      reasoning: 'x',
      final_message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with non-string entries in applied_rules', () => {
    const result = groundedCompositionSchema.safeParse({
      applied_rules: [123],
      context_used: false,
      context_excerpts: [],
      reasoning: 'x',
      final_message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing final_message', () => {
    const result = groundedCompositionSchema.safeParse({
      applied_rules: ['x'],
      context_used: false,
      context_excerpts: [],
      reasoning: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('converts to a strict JSON Schema response_format via zodResponseFormat', async () => {
    const { zodResponseFormat } = await import('openai/helpers/zod.mjs');
    const format = zodResponseFormat(groundedCompositionSchema, 'grounded_composition');
    expect(format.type).toBe('json_schema');
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.name).toBe('grounded_composition');
  });
});

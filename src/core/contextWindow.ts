/**
 * Approximates token count as characters / 4, a common heuristic for English-like text.
 * Kept dependency-free per plan.md (only `zod` and `openai` are declared dependencies) —
 * an exact tokenizer would require an extra package outside that scope.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const KNOWN_MODEL_LIMITS: Record<string, number> = {
  "gpt-4o-mini": 128_000,
  "gpt-4o": 128_000,
  "gpt-4-turbo": 128_000,
};

const DEFAULT_MODEL_LIMIT = 128_000;

/** Fraction of the model's raw limit treated as usable, leaving a safety margin (FR-011). */
const SAFETY_MARGIN_RATIO = 0.9;

export function getMaxContextTokens(model: string): number {
  const rawLimit = KNOWN_MODEL_LIMITS[model] ?? DEFAULT_MODEL_LIMIT;
  return Math.floor(rawLimit * SAFETY_MARGIN_RATIO);
}

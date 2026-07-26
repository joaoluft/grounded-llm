import { createHash } from 'node:crypto';

/**
 * Minimal, storage-agnostic result cache contract (009-pluggable-result-cache FR-002).
 * The library never calls anything but `get`/`set` — no delete, enumerate, or expiry
 * hook exists here; invalidation policy is entirely the caller's responsibility (FR-006).
 * Both methods are always awaited, so synchronous and Promise-returning implementations
 * work identically (FR-008).
 */
export interface ResultCache {
  get(key: string): unknown | undefined | Promise<unknown | undefined>;
  set(key: string, value: unknown): void | Promise<void>;
}

/**
 * Recursively sorts object keys so two logically-identical inputs with differently
 * ordered fields always stable-stringify to the same text (009-pluggable-result-cache
 * FR-003, research.md Decision 2).
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Derives a deterministic cache key from an operation label and its output-affecting
 * input. Two calls with equivalent `input` (regardless of field order) always produce
 * the same key; any difference in `input`, or a different `operation`, changes it
 * (009-pluggable-result-cache FR-003).
 */
export function deriveCacheKey(operation: string, input: unknown): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(sortKeysDeep(input)))
    .digest('hex');
  return `${operation}:${digest}`;
}

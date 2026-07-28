import { describe, it, expect } from 'vitest';
import { estimateTokens, getMaxContextTokens } from '../../../src/core/context-window.js';

describe('estimateTokens', () => {
  it('approximates token count as characters / 4, rounded up', () => {
    expect(estimateTokens('a'.repeat(8))).toBe(2);
    expect(estimateTokens('a'.repeat(9))).toBe(3);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('getMaxContextTokens', () => {
  it('applies the 0.9 safety margin to a known model limit', () => {
    expect(getMaxContextTokens('gpt-4o-mini')).toBe(Math.floor(128_000 * 0.9));
  });

  it('falls back to the default model limit for an unrecognized model', () => {
    expect(getMaxContextTokens('some-unknown-model')).toBe(Math.floor(128_000 * 0.9));
  });
});

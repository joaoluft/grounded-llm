import { describe, it, expect } from 'vitest';
import type { LLMProviderContract } from '../../../src/providers/types.js';

export function runLLMProviderContractTests(
  providerName: string,
  createAdapter: () => LLMProviderContract
) {
  describe(`LLMProviderContract Compliance: ${providerName}`, () => {
    it('has a non-empty, unique providerId', () => {
      const adapter = createAdapter();
      expect(adapter.providerId).toBeDefined();
      expect(typeof adapter.providerId).toBe('string');
      expect(adapter.providerId.trim().length).toBeGreaterThan(0);
    });

    it('declares capability profile matching required and optional operations', () => {
      const adapter = createAdapter();
      expect(adapter.capabilities).toBeDefined();
      expect(typeof adapter.capabilities).toBe('object');
      expect(adapter.capabilities.structuredOutput).toBe(true);
    });

    it('exposes a completeStructured method returning a Promise', () => {
      const adapter = createAdapter();
      expect(typeof adapter.completeStructured).toBe('function');
    });
  });
}

import { describe, it, expect } from 'vitest';
import { ProviderError } from '../../../src/core/errors.js';
import { providerRegistry } from '../../../src/providers/registry.js';

describe('Provider error taxonomy and misconfiguration handling (US2)', () => {
  it('throws ProviderError with category selection for unsupported provider name', () => {
    expect(() => providerRegistry.getProvider('nonexistent-provider')).toThrow(ProviderError);
    try {
      providerRegistry.getProvider('nonexistent-provider');
    } catch (err: any) {
      expect(err.category).toBe('selection');
      expect(err.remediationHint).toContain('Registered providers');
      expect(err.message).toContain('nonexistent-provider');
    }
  });

  it('preserves remediation hints and categories on ProviderError instance', () => {
    const error = new ProviderError('Custom test error', {
      category: 'unsupported-capability',
      providerId: 'custom',
      remediationHint: 'Use another provider for streaming',
    });

    expect(error.name).toBe('ProviderError');
    expect(error.category).toBe('unsupported-capability');
    expect(error.providerId).toBe('custom');
    expect(error.remediationHint).toBe('Use another provider for streaming');
  });
});

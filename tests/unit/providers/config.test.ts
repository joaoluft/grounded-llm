import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveProviderId,
  resolveProviderApiKey,
  validateProviderCredentials,
} from '../../../src/providers/config.js';
import { ProviderError } from '../../../src/core/errors.js';

describe('Provider selection config & precedence (US2)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GROUNDED_LLM_PROVIDER;
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to openai when no parameter or environment variable is set', () => {
    expect(resolveProviderId()).toBe('openai');
  });

  it('prefers environment variable when parameter is omitted', () => {
    process.env.GROUNDED_LLM_PROVIDER = 'anthropic';
    expect(resolveProviderId()).toBe('anthropic');
  });

  it('prefers explicit parameter over environment variable (precedence rule)', () => {
    process.env.GROUNDED_LLM_PROVIDER = 'anthropic';
    expect(resolveProviderId('google')).toBe('google');
  });

  it('resolves API keys per provider from env or options', () => {
    process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
    expect(resolveProviderApiKey('anthropic')).toBe('env-anthropic-key');
    expect(resolveProviderApiKey('anthropic', 'param-key')).toBe('param-key');
  });

  it('resolves the google API key from GEMINI_API_KEY, falling back to GOOGLE_API_KEY', () => {
    process.env.GOOGLE_API_KEY = 'env-google-key';
    expect(resolveProviderApiKey('google')).toBe('env-google-key');
    process.env.GEMINI_API_KEY = 'env-gemini-key';
    expect(resolveProviderApiKey('google')).toBe('env-gemini-key');
  });

  it('returns undefined for an unrecognized provider with no explicit key', () => {
    expect(resolveProviderApiKey('unknown-provider')).toBeUndefined();
  });

  it('throws ProviderError with category auth when credentials are missing', () => {
    expect(() => validateProviderCredentials('anthropic')).toThrow(ProviderError);
    try {
      validateProviderCredentials('anthropic');
    } catch (err: any) {
      expect(err.category).toBe('auth');
      expect(err.remediationHint).toContain('ANTHROPIC_API_KEY');
    }
  });

  it('includes OPENAI_API_KEY in the remediation hint for the openai provider', () => {
    try {
      validateProviderCredentials('openai');
      expect.unreachable();
    } catch (err: any) {
      expect(err.remediationHint).toContain('OPENAI_API_KEY');
    }
  });

  it('includes GEMINI_API_KEY/GOOGLE_API_KEY in the remediation hint for the google provider', () => {
    try {
      validateProviderCredentials('google');
      expect.unreachable();
    } catch (err: any) {
      expect(err.remediationHint).toContain('GEMINI_API_KEY');
      expect(err.remediationHint).toContain('GOOGLE_API_KEY');
    }
  });

  it('falls back to the generic hint for an unrecognized provider', () => {
    try {
      validateProviderCredentials('unknown-provider');
      expect.unreachable();
    } catch (err: any) {
      expect(err.remediationHint).toContain('configuration parameter or environment variable');
    }
  });
});

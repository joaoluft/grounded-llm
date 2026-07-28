import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../../src/providers/registry.js';
import { OpenAIProviderAdapter } from '../../../src/providers/openai.js';
import { AnthropicProviderAdapter } from '../../../src/providers/anthropic.js';
import { GoogleProviderAdapter } from '../../../src/providers/google.js';
import { ProviderError } from '../../../src/core/errors.js';
import type {
  LLMProviderContract,
  ProviderRequest,
  ProviderResponse,
} from '../../../src/providers/types.js';

function makeCustomAdapter(providerId: string): LLMProviderContract {
  return {
    providerId,
    capabilities: { structuredOutput: true },
    completeStructured: async <T>(_request: ProviderRequest): Promise<ProviderResponse<T>> => ({
      data: {} as T,
      finishStatus: 'stop',
    }),
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('getProvider', () => {
    it('instantiates OpenAIProviderAdapter for "openai"', () => {
      const provider = registry.getProvider('openai', { client: {} });
      expect(provider).toBeInstanceOf(OpenAIProviderAdapter);
    });

    it('instantiates AnthropicProviderAdapter for "anthropic"', () => {
      const provider = registry.getProvider('anthropic', { client: {} });
      expect(provider).toBeInstanceOf(AnthropicProviderAdapter);
    });

    it('instantiates GoogleProviderAdapter for "google"', () => {
      const provider = registry.getProvider('google', { client: {} });
      expect(provider).toBeInstanceOf(GoogleProviderAdapter);
    });

    it('is case-insensitive and trims whitespace when resolving built-in providers', () => {
      const provider = registry.getProvider('  OpenAI  ', { client: {} });
      expect(provider).toBeInstanceOf(OpenAIProviderAdapter);
    });

    it('returns options.providerAdapter directly when provided, bypassing built-in resolution', () => {
      const customAdapter = makeCustomAdapter('openai');
      const provider = registry.getProvider('openai', { providerAdapter: customAdapter });
      expect(provider).toBe(customAdapter);
    });

    it('resolves a registered custom provider by id', () => {
      const customAdapter = makeCustomAdapter('mistral');
      registry.registerProvider(customAdapter);
      const provider = registry.getProvider('mistral');
      expect(provider).toBe(customAdapter);
    });

    it('throws ProviderError for unsupported/unregistered provider', () => {
      expect(() => registry.getProvider('does-not-exist')).toThrow(ProviderError);
    });

    it('includes registered custom provider ids in the unsupported-provider remediation hint', () => {
      registry.registerProvider(makeCustomAdapter('mistral'));
      try {
        registry.getProvider('does-not-exist');
        expect.unreachable('expected getProvider to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).remediationHint).toContain('mistral');
        expect((error as ProviderError).category).toBe('selection');
      }
    });
  });

  describe('registerProvider', () => {
    it('registers a custom adapter and makes it resolvable via getProvider', () => {
      const customAdapter = makeCustomAdapter('custom-llm');
      registry.registerProvider(customAdapter);
      expect(registry.getProvider('CUSTOM-LLM')).toBe(customAdapter);
    });

    it('overwrites an existing registration for the same providerId', () => {
      const first = makeCustomAdapter('mistral');
      const second = makeCustomAdapter('mistral');
      registry.registerProvider(first);
      registry.registerProvider(second);
      expect(registry.getProvider('mistral')).toBe(second);
    });

    it('throws ProviderError when providerId is empty or whitespace-only', () => {
      expect(() => registry.registerProvider(makeCustomAdapter(''))).toThrow(ProviderError);
      expect(() => registry.registerProvider(makeCustomAdapter('   '))).toThrow(ProviderError);
    });
  });

  describe('hasProvider', () => {
    it('returns true for built-in providers regardless of case/whitespace', () => {
      expect(registry.hasProvider('openai')).toBe(true);
      expect(registry.hasProvider(' Anthropic ')).toBe(true);
      expect(registry.hasProvider('GOOGLE')).toBe(true);
    });

    it('returns true for a registered custom provider', () => {
      registry.registerProvider(makeCustomAdapter('mistral'));
      expect(registry.hasProvider('mistral')).toBe(true);
    });

    it('returns false for an unknown provider', () => {
      expect(registry.hasProvider('does-not-exist')).toBe(false);
    });
  });

  describe('listProviders', () => {
    it('lists built-in providers by default', () => {
      expect(registry.listProviders()).toEqual(['openai', 'anthropic', 'google']);
    });

    it('appends registered custom providers without duplicating built-ins', () => {
      registry.registerProvider(makeCustomAdapter('mistral'));
      registry.registerProvider(makeCustomAdapter('openai'));
      expect(registry.listProviders()).toEqual(['openai', 'anthropic', 'google', 'mistral']);
    });
  });

  describe('clear', () => {
    it('removes all registered custom providers', () => {
      registry.registerProvider(makeCustomAdapter('mistral'));
      registry.clear();
      expect(registry.hasProvider('mistral')).toBe(false);
      expect(registry.listProviders()).toEqual(['openai', 'anthropic', 'google']);
    });
  });
});

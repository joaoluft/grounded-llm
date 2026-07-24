import { ProviderError } from '../core/errors.js';
import type { LLMProviderContract } from './types.js';
import { OpenAIProviderAdapter } from './openai.js';
import { AnthropicProviderAdapter } from './anthropic.js';
import { GoogleProviderAdapter } from './google.js';

export class ProviderRegistry {
  private providers = new Map<string, LLMProviderContract>();

  /**
   * Registers a custom provider adapter. Overwrites existing registration for the same providerId.
   */
  registerProvider(adapter: LLMProviderContract): void {
    if (!adapter.providerId || adapter.providerId.trim() === '') {
      throw new ProviderError('Provider adapter must have a non-empty providerId.', {
        category: 'selection',
        remediationHint: 'Ensure adapter defines a valid providerId property.',
      });
    }
    const key = adapter.providerId.trim().toLowerCase();
    this.providers.set(key, adapter);
  }

  /**
   * Retrieves a registered provider adapter by providerId.
   * Instantiates standard adapters (openai, anthropic, google) on demand with options.
   * Throws ProviderError if provider is not registered or credentials are missing.
   */
  getProvider(providerId: string, options?: Record<string, any>): LLMProviderContract {
    const key = providerId.trim().toLowerCase();

    if (options?.providerAdapter && typeof options.providerAdapter === 'object') {
      return options.providerAdapter;
    }

    if (key === 'openai') {
      return new OpenAIProviderAdapter(options);
    }

    if (key === 'anthropic') {
      return new AnthropicProviderAdapter(options);
    }

    if (key === 'google') {
      return new GoogleProviderAdapter(options);
    }

    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    const available = ['openai', 'anthropic', 'google', ...Array.from(this.providers.keys())].join(
      ', '
    );
    throw new ProviderError(`Unsupported or unregistered LLM provider '${providerId}'.`, {
      category: 'selection',
      providerId,
      remediationHint: `Registered providers: [${available}]. Ensure provider name is spelled correctly or register custom provider adapter.`,
    });
  }

  hasProvider(providerId: string): boolean {
    const key = providerId.trim().toLowerCase();
    return key === 'openai' || key === 'anthropic' || key === 'google' || this.providers.has(key);
  }

  listProviders(): string[] {
    const defaultList = ['openai', 'anthropic', 'google'];
    const customList = Array.from(this.providers.keys()).filter((k) => !defaultList.includes(k));
    return [...defaultList, ...customList];
  }

  clear(): void {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();

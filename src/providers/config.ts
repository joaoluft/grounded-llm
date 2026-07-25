import { ProviderError } from '../core/errors.js';

export interface ProviderSelectionConfig {
  provider?: string;
  providerOptions?: Record<string, any>;
  apiKey?: string;
}

export const DEFAULT_PROVIDER_ID = 'openai';

/**
 * Resolves the active provider ID based on deterministic precedence:
 * 1. Explicit runtime parameter
 * 2. Environment variable (`GROUNDED_LLM_PROVIDER` or `LLM_PROVIDER`)
 * 3. Default provider ('openai')
 */
export function resolveProviderId(explicitProvider?: string): string {
  if (explicitProvider && explicitProvider.trim() !== '') {
    return explicitProvider.trim().toLowerCase();
  }

  const envProvider = process.env.GROUNDED_LLM_PROVIDER || process.env.LLM_PROVIDER;
  if (envProvider && envProvider.trim() !== '') {
    return envProvider.trim().toLowerCase();
  }

  return DEFAULT_PROVIDER_ID;
}

/**
 * Resolves provider API keys from explicit option or standard environment variables.
 */
export function resolveProviderApiKey(
  providerId: string,
  explicitApiKey?: string
): string | undefined {
  if (explicitApiKey && explicitApiKey.trim() !== '') {
    return explicitApiKey.trim();
  }

  switch (providerId.toLowerCase()) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Validates that credentials for the resolved provider are present.
 * Throws a ProviderError with category 'auth' and a remediation hint if missing.
 */
export function validateProviderCredentials(providerId: string, apiKey?: string): string {
  const resolvedKey = resolveProviderApiKey(providerId, apiKey);
  if (!resolvedKey || resolvedKey.trim() === '') {
    let hint = `Please set the API key via configuration parameter or environment variable.`;
    if (providerId === 'openai') {
      hint = `Set OPENAI_API_KEY environment variable or pass apiKey in provider options.`;
    } else if (providerId === 'anthropic') {
      hint = `Set ANTHROPIC_API_KEY environment variable or pass apiKey in provider options.`;
    } else if (providerId === 'google') {
      hint = `Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable or pass apiKey in provider options.`;
    }

    throw new ProviderError(`Missing credentials for provider '${providerId}'. ${hint}`, {
      category: 'auth',
      providerId,
      remediationHint: hint,
    });
  }
  return resolvedKey;
}

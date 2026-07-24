import { describe } from 'vitest';
import { runLLMProviderContractTests } from './contract-runner.js';
import { OpenAIProviderAdapter } from '../../../src/providers/openai.js';
import { AnthropicProviderAdapter } from '../../../src/providers/anthropic.js';
import { GoogleProviderAdapter } from '../../../src/providers/google.js';

describe('Shared LLM Provider Contract Test Suite (US3 / FR-008)', () => {
  runLLMProviderContractTests('OpenAI', () => {
    return new OpenAIProviderAdapter({ apiKey: 'mock-key' });
  });

  runLLMProviderContractTests('Anthropic', () => {
    return new AnthropicProviderAdapter({ apiKey: 'mock-key' });
  });

  runLLMProviderContractTests('Google', () => {
    return new GoogleProviderAdapter({ apiKey: 'mock-key' });
  });
});

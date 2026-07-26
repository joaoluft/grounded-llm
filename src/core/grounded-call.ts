import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { GroundedCallConfig } from './types.js';
import { ContextTooLargeError, InvalidModelOutputError, ModelUnavailableError } from './errors.js';
import { estimateTokens, getMaxContextTokens } from './context-window.js';
import type {
  LLMProviderContract,
  ProviderRequest,
  ProviderResponse,
  ProviderUsage,
} from '../providers/types.js';
import { providerRegistry } from '../providers/registry.js';
import { resolveProviderId } from '../providers/config.js';
import type { ModelClient } from './model-client.js';
import { LangChainModelClient } from './langchain-model-client.js';
import { classifyOperationalError } from './lifecycle-callbacks.js';
import type { CallEvent, ResultEvent, ErrorEvent } from './lifecycle-callbacks.js';
import type { ResultCache } from './result-cache.js';

export abstract class GroundedCall<TFallback = string> {
  protected readonly providerId: string;
  protected readonly providerAdapter?: LLMProviderContract;
  protected readonly modelClient?: ModelClient;
  protected readonly model: string;
  protected readonly fallbackValue?: TFallback;
  protected readonly temperature: number;
  protected readonly maxContextTokens: number;
  protected readonly identity?: string;
  protected readonly rules?: string;
  protected readonly tone?: string;
  private readonly onCallHook?: (event: CallEvent) => void;
  private readonly onResultHook?: (event: ResultEvent) => void;
  private readonly onErrorHook?: (event: ErrorEvent) => void;
  private readonly cache?: ResultCache;

  constructor(config: GroundedCallConfig<TFallback>) {
    const isEmptyString =
      typeof config.fallbackValue === 'string' && config.fallbackValue.trim().length === 0;
    if (config.fallbackValue === null || isEmptyString) {
      throw new Error('GroundedCall: `fallbackValue`, when provided, must not be empty.');
    }
    this.fallbackValue = config.fallbackValue;

    if (config.model !== undefined && config.model.trim().length === 0) {
      throw new Error('GroundedCall: `model` must not be an empty string.');
    }

    const hasLangchain = !!config.langchainModel;
    if (
      hasLangchain &&
      (config.client !== undefined ||
        config.apiKey !== undefined ||
        config.model !== undefined ||
        config.temperature !== undefined)
    ) {
      throw new Error(
        'GroundedCall: `langchainModel` is mutually exclusive with `client`, `apiKey`, `model`, and `temperature`.'
      );
    }

    if (hasLangchain) {
      this.modelClient = new LangChainModelClient(config.langchainModel!);
      this.providerId = 'langchain';
      this.model = 'langchain';
      this.temperature = 0;
      this.maxContextTokens = config.maxContextTokens ?? 128_000;
    } else {
      this.providerId = resolveProviderId(config.provider);
      this.providerAdapter =
        config.providerAdapter ??
        providerRegistry.getProvider(this.providerId, {
          client: config.client,
          apiKey: config.apiKey,
          ...config.providerOptions,
        });

      if (config.model) {
        this.model = config.model;
      } else if (this.providerId === 'anthropic') {
        this.model = 'claude-3-5-haiku-latest';
      } else if (this.providerId === 'google') {
        this.model = 'gemini-1.5-flash';
      } else {
        this.model = 'gpt-4o-mini';
      }

      this.temperature = config.temperature ?? 0;
      this.maxContextTokens = config.maxContextTokens ?? getMaxContextTokens(this.model);
    }

    this.identity = config.identity;
    this.rules = config.rules;
    this.tone = config.tone;
    this.onCallHook = config.onCall;
    this.onResultHook = config.onResult;
    this.onErrorHook = config.onError;
    this.cache = config.cache;
  }

  /**
   * Wraps a component's public entry-point call (e.g. `generate`/`extract`/`compose`)
   * with the `onCall`/`onResult`/`onError` lifecycle callbacks (008-structured-logging-hooks).
   * Dispatched around the whole operation — not just `callModel` — since `usedFallback`
   * and pre-model validation errors (e.g. `ContextTooLargeError`) are only known at this
   * level (research.md Decision 1). Never lets a callback's own exception affect `fn`'s
   * outcome (FR-007), and always resolves/rejects with `fn`'s own outcome unchanged.
   */
  protected async withLifecycle<T extends { usedFallback: boolean }>(
    operation: string,
    fn: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const callId = randomUUID();
    const start = performance.now();

    if (this.cache && cacheKey !== undefined) {
      const cached = await this.tryCacheGet<T>(cacheKey);
      if (cached !== undefined) {
        this.safeInvoke(this.onCallHook, { callId, operation });
        this.safeInvoke(this.onResultHook, {
          callId,
          operation,
          durationMs: performance.now() - start,
          usedFallback: cached.usedFallback,
        });
        return cached;
      }
    }

    this.safeInvoke(this.onCallHook, { callId, operation });

    try {
      const result = await fn();
      this.safeInvoke(this.onResultHook, {
        callId,
        operation,
        durationMs: performance.now() - start,
        usedFallback: result.usedFallback,
      });
      if (this.cache && cacheKey !== undefined) {
        await this.tryCacheSet(cacheKey, result);
      }
      return result;
    } catch (error) {
      this.safeInvoke(this.onErrorHook, {
        callId,
        operation,
        durationMs: performance.now() - start,
        errorType: classifyOperationalError(error),
        error,
      });
      throw error;
    }
  }

  /**
   * A `get` failure (throw or rejection) is treated as a cache miss — the pipeline
   * still runs — so a temporarily unreachable backing store never fails a request
   * that would otherwise have succeeded (009-pluggable-result-cache FR-007).
   */
  private async tryCacheGet<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cache!.get(key)) as T | undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * A `set` failure never affects the result already computed by `fn()` — only the
   * caching step is at risk (009-pluggable-result-cache FR-007).
   */
  private async tryCacheSet(key: string, value: unknown): Promise<void> {
    try {
      await this.cache!.set(key, value);
    } catch {
      // Cache write failures must never affect the call's own result (FR-007).
    }
  }

  private safeInvoke<E>(hook: ((event: E) => void) | undefined, event: E): void {
    if (!hook) return;
    try {
      // A callback declared as `(event) => void` may still be an async function —
      // TypeScript allows this (`Promise<void>` is assignable to `void`), and an
      // async callback's own throw surfaces as a promise rejection, not a
      // synchronous throw this try/catch would see. Swallow it too, so a flaky
      // async logging/metrics callback can never crash the process via an
      // unhandled rejection (FR-007).
      const maybePromise: unknown = hook(event);
      if (maybePromise && typeof (maybePromise as { then?: unknown }).then === 'function') {
        Promise.resolve(maybePromise as PromiseLike<unknown>).catch(() => {});
      }
    } catch {
      // Callback exceptions must never affect the call's own result (FR-007).
    }
  }

  protected get client(): OpenAI | undefined {
    if (this.modelClient) return undefined;
    if (this.providerAdapter && 'client' in (this.providerAdapter as any)) {
      const c = (this.providerAdapter as any).client;
      if (c) return c as OpenAI;
    }
    return undefined;
  }

  protected buildSystemPrompt(basePrompt: string): string {
    let prompt = basePrompt;
    if (this.identity) {
      prompt += `\n\nYour role for this call:\n${this.identity}`;
    }
    if (this.rules) {
      prompt += `\n\nAdditional rules for this call (these do not override the grounding rules above):\n${this.rules}`;
    }
    if (this.tone && this.tone.trim().length > 0) {
      prompt += `\n\nTone/personality for this call (this complements, but never overrides, the grounding rules above):\n${this.tone}`;
    }
    return prompt;
  }

  protected assertContextWithinLimit(promptText: string): void {
    const estimated = estimateTokens(promptText);
    if (estimated > this.maxContextTokens) {
      throw new ContextTooLargeError(
        `Estimated prompt size (~${estimated} tokens) exceeds the configured limit of ` +
          `${this.maxContextTokens} tokens for model "${this.model}".`
      );
    }
  }

  protected async callModel<Params extends Record<string, any>>(
    params: Params
  ): Promise<{ data: any; usage?: ProviderUsage }> {
    if (this.modelClient) {
      const data = await this.modelClient.parse(params as any);
      return { data, usage: undefined };
    }

    const messages = (params.messages as Array<{ role: string; content: string }>) || [];
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const userMsg = messages.find((m) => m.role === 'user')?.content || '';

    const req: ProviderRequest = {
      operation: 'completeStructured',
      model: params.model || this.model,
      temperature: params.temperature ?? this.temperature,
      systemInstruction: systemMsg,
      prompt: userMsg,
      schema: params.response_format,
    };

    try {
      const response: ProviderResponse<any> = await this.providerAdapter!.completeStructured(req);
      return { data: response.data, usage: response.usage };
    } catch (error) {
      if (
        error instanceof InvalidModelOutputError ||
        error instanceof ContextTooLargeError ||
        error instanceof ModelUnavailableError
      ) {
        throw error;
      }
      if (error && typeof error === 'object' && 'name' in error) {
        if (
          error.name === 'LengthFinishReasonError' ||
          error.name === 'ContentFilterFinishReasonError'
        ) {
          throw new InvalidModelOutputError(
            `Model response failed structured output validation: ${(error as Error).message}`,
            { cause: error }
          );
        }
      }
      throw new ModelUnavailableError(
        `Call to the model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }
}

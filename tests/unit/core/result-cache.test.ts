import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedCall } from '../../../src/core/grounded-call.js';
import { deriveCacheKey } from '../../../src/core/result-cache.js';
import type { ResultCache } from '../../../src/core/result-cache.js';
import type { GroundedCallConfig } from '../../../src/core/types.js';

const parseMock = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { beta: { chat: { completions: { parse: parseMock } } } };
    }),
  };
});

class TestableGroundedCall extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }
  public run<T extends { usedFallback: boolean }>(
    operation: string,
    fn: () => Promise<T>,
    cacheKey?: string
  ) {
    return this.withLifecycle(operation, fn, cacheKey);
  }
}

function makeCall(config: Omit<GroundedCallConfig, 'fallbackValue'> = {}) {
  process.env['OPENAI_API_KEY'] = 'test-key';
  return new TestableGroundedCall({ fallbackValue: 'sorry', ...config });
}

function mapCache(): ResultCache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
  };
}

describe('deriveCacheKey()', () => {
  it('produces the same key for field-order-shuffled but logically identical input', () => {
    const a = deriveCacheKey('op', { context: 'c', question: 'q', identity: 'i' });
    const b = deriveCacheKey('op', { identity: 'i', question: 'q', context: 'c' });
    expect(a).toBe(b);
  });

  it('produces a different key when any single field differs', () => {
    const base = deriveCacheKey('op', {
      context: 'c',
      question: 'q',
      identity: 'i',
      rules: 'r',
      tone: 't',
      model: 'm',
      temperature: 0,
    });
    expect(
      deriveCacheKey('op', {
        context: 'C',
        question: 'q',
        identity: 'i',
        rules: 'r',
        tone: 't',
        model: 'm',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'Q',
        identity: 'i',
        rules: 'r',
        tone: 't',
        model: 'm',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'q',
        identity: 'I',
        rules: 'r',
        tone: 't',
        model: 'm',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'q',
        identity: 'i',
        rules: 'R',
        tone: 't',
        model: 'm',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'q',
        identity: 'i',
        rules: 'r',
        tone: 'T',
        model: 'm',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'q',
        identity: 'i',
        rules: 'r',
        tone: 't',
        model: 'M',
        temperature: 0,
      })
    ).not.toBe(base);
    expect(
      deriveCacheKey('op', {
        context: 'c',
        question: 'q',
        identity: 'i',
        rules: 'r',
        tone: 't',
        model: 'm',
        temperature: 1,
      })
    ).not.toBe(base);
  });

  it('produces different keys for different operations given identical input', () => {
    const input = { context: 'c', question: 'q' };
    expect(deriveCacheKey('GroundedGenerator.generate', input)).not.toBe(
      deriveCacheKey('GroundedComposer.compose', input)
    );
  });
});

describe('GroundedCall.withLifecycle() - cache hit', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('does not invoke fn(), returns the cached value, and still fires onCall/onResult', async () => {
    const cache = mapCache();
    cache.store.set('key-1', { usedFallback: false, value: 'cached' });
    const onCall = vi.fn();
    const onResult = vi.fn();
    const onError = vi.fn();
    const call = makeCall({ cache, onCall, onResult, onError });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 'fresh' });
    const result = await call.run('Test.op', fn, 'key-1');

    expect(result).toEqual({ usedFallback: false, value: 'cached' });
    expect(fn).not.toHaveBeenCalled();
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onResult.mock.calls[0][0].usedFallback).toBe(false);
    expect(onResult.mock.calls[0][0].callId).toBe(onCall.mock.calls[0][0].callId);
  });
});

describe('GroundedCall.withLifecycle() - cache miss (write-through)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('runs fn() once and stores its result under the cache key', async () => {
    const cache = mapCache();
    const call = makeCall({ cache });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 'fresh' });
    const result = await call.run('Test.op', fn, 'key-1');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ usedFallback: false, value: 'fresh' });
    expect(cache.store.get('key-1')).toEqual({ usedFallback: false, value: 'fresh' });
  });
});

describe('GroundedCall.withLifecycle() - cache failure isolation (FR-007)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('treats a throwing get() as a miss: fn() still runs and its result is still returned', async () => {
    const cache: ResultCache = {
      get: () => {
        throw new Error('store unreachable');
      },
      set: vi.fn(),
    };
    const call = makeCall({ cache });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 'fresh' });
    await expect(call.run('Test.op', fn, 'key-1')).resolves.toEqual({
      usedFallback: false,
      value: 'fresh',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('treats a rejecting get() as a miss', async () => {
    const cache: ResultCache = {
      get: () => Promise.reject(new Error('store unreachable')),
      set: vi.fn(),
    };
    const call = makeCall({ cache });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 'fresh' });
    await expect(call.run('Test.op', fn, 'key-1')).resolves.toEqual({
      usedFallback: false,
      value: 'fresh',
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a throwing/rejecting set() after a successful fn() does not change the returned value or propagate', async () => {
    const cache: ResultCache = {
      get: () => undefined,
      set: () => {
        throw new Error('store unreachable');
      },
    };
    const call = makeCall({ cache });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 'fresh' });
    await expect(call.run('Test.op', fn, 'key-1')).resolves.toEqual({
      usedFallback: false,
      value: 'fresh',
    });

    const rejectingCache: ResultCache = {
      get: () => undefined,
      set: () => Promise.reject(new Error('store unreachable')),
    };
    const call2 = makeCall({ cache: rejectingCache });
    await expect(call2.run('Test.op', fn, 'key-1')).resolves.toEqual({
      usedFallback: false,
      value: 'fresh',
    });
  });
});

describe('GroundedCall.withLifecycle() - no caching when unconfigured/no cacheKey (US2)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('never touches cache.get/cache.set when no cache is configured', async () => {
    const call = makeCall();
    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 1 });
    await call.run('Test.op', fn, 'key-1');
    await call.run('Test.op', fn, 'key-1');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never touches cache.get/cache.set when cache is configured but no cacheKey is passed', async () => {
    const cache = mapCache();
    const getSpy = vi.spyOn(cache, 'get');
    const setSpy = vi.spyOn(cache, 'set');
    const call = makeCall({ cache });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 1 });
    await call.run('Test.op', fn);

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('GroundedCall.withLifecycle() - sync and async cache implementations (US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('works identically with a synchronous cache and a Promise-returning cache', async () => {
    const syncCache = mapCache();
    const asyncCache: ResultCache = {
      get: async (key) => syncCache.store.get(key),
      set: async (key, value) => {
        syncCache.store.set(key, value);
      },
    };

    const call1 = makeCall({ cache: syncCache });
    const fn1 = vi.fn().mockResolvedValue({ usedFallback: false, value: 'sync' });
    await call1.run('Test.op', fn1, 'shared-key');
    await call1.run('Test.op', fn1, 'shared-key');
    expect(fn1).toHaveBeenCalledTimes(1);

    syncCache.store.clear();
    const call2 = makeCall({ cache: asyncCache });
    const fn2 = vi.fn().mockResolvedValue({ usedFallback: false, value: 'async' });
    await call2.run('Test.op', fn2, 'shared-key');
    await call2.run('Test.op', fn2, 'shared-key');
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroundedCall } from '../../../src/core/grounded-call.js';
import {
  ModelUnavailableError,
  ContextTooLargeError,
  InvalidModelOutputError,
  ProviderError,
} from '../../../src/core/errors.js';
import { classifyOperationalError } from '../../../src/core/lifecycle-callbacks.js';
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
  public run<T extends { usedFallback: boolean }>(operation: string, fn: () => Promise<T>) {
    return this.withLifecycle(operation, fn);
  }
}

function makeCall(config: Omit<GroundedCallConfig, 'fallbackValue'> = {}) {
  process.env['OPENAI_API_KEY'] = 'test-key';
  return new TestableGroundedCall({ fallbackValue: 'sorry', ...config });
}

describe('classifyOperationalError()', () => {
  it('classifies ModelUnavailableError as model-unavailable', () => {
    expect(classifyOperationalError(new ModelUnavailableError('down'))).toBe('model-unavailable');
  });

  it('classifies InvalidModelOutputError as invalid-output', () => {
    expect(classifyOperationalError(new InvalidModelOutputError('bad output'))).toBe(
      'invalid-output'
    );
  });

  it('classifies ContextTooLargeError as context-too-large', () => {
    expect(classifyOperationalError(new ContextTooLargeError('too big'))).toBe('context-too-large');
  });

  it('classifies ProviderError as provider-error', () => {
    expect(classifyOperationalError(new ProviderError('bad provider', { category: 'auth' }))).toBe(
      'provider-error'
    );
  });

  it('classifies a plain Error (and any other thrown value) as unknown', () => {
    expect(classifyOperationalError(new Error('some usage error'))).toBe('unknown');
    expect(classifyOperationalError('a string throw')).toBe('unknown');
    expect(classifyOperationalError(undefined)).toBe('unknown');
  });
});

describe('GroundedCall.withLifecycle() - success path', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('fires onCall once before fn(), onResult once after with matching callId, durationMs, and usedFallback; never fires onError', async () => {
    const onCall = vi.fn();
    const onResult = vi.fn();
    const onError = vi.fn();
    const call = makeCall({ onCall, onResult, onError });

    const fn = vi.fn().mockResolvedValue({ usedFallback: false, value: 42 });
    const result = await call.run('Test.op', fn);

    expect(result).toEqual({ usedFallback: false, value: 42 });
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    const callEvent = onCall.mock.calls[0][0];
    const resultEvent = onResult.mock.calls[0][0];
    expect(callEvent.operation).toBe('Test.op');
    expect(typeof callEvent.callId).toBe('string');
    expect(callEvent.callId.length).toBeGreaterThan(0);
    expect(resultEvent.callId).toBe(callEvent.callId);
    expect(resultEvent.operation).toBe('Test.op');
    expect(resultEvent.durationMs).toBeGreaterThanOrEqual(0);
    expect(resultEvent.usedFallback).toBe(false);

    // onCall must fire before fn() is invoked.
    expect(onCall.mock.invocationCallOrder[0]).toBeLessThan(fn.mock.invocationCallOrder[0]);
  });

  it('reports usedFallback: true when the resolved result says so', async () => {
    const onResult = vi.fn();
    const call = makeCall({ onResult });

    await call.run('Test.op', async () => ({ usedFallback: true }));

    expect(onResult.mock.calls[0][0].usedFallback).toBe(true);
  });

  it('generates a distinct callId per call attempt', async () => {
    const onCall = vi.fn();
    const call = makeCall({ onCall });

    await call.run('Test.op', async () => ({ usedFallback: false }));
    await call.run('Test.op', async () => ({ usedFallback: false }));

    expect(onCall.mock.calls[0][0].callId).not.toBe(onCall.mock.calls[1][0].callId);
  });
});

describe('GroundedCall.withLifecycle() - failure path', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it.each([
    [new ModelUnavailableError('down'), 'model-unavailable'],
    [new InvalidModelOutputError('bad'), 'invalid-output'],
    [new ContextTooLargeError('too big'), 'context-too-large'],
    [new ProviderError('bad', { category: 'auth' }), 'provider-error'],
    [new Error('usage error'), 'unknown'],
  ] as const)(
    'fires onError with errorType %2$s for %1$s, never fires onResult, and re-throws the original error',
    async (error, errorType) => {
      const onCall = vi.fn();
      const onResult = vi.fn();
      const onError = vi.fn();
      const call = makeCall({ onCall, onResult, onError });

      await expect(
        call.run('Test.op', async () => {
          throw error;
        })
      ).rejects.toBe(error);

      expect(onResult).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      const errorEvent = onError.mock.calls[0][0];
      expect(errorEvent.errorType).toBe(errorType);
      expect(errorEvent.error).toBe(error);
      expect(errorEvent.callId).toBe(onCall.mock.calls[0][0].callId);
      expect(errorEvent.operation).toBe('Test.op');
      expect(errorEvent.durationMs).toBeGreaterThanOrEqual(0);
    }
  );
});

describe('GroundedCall.withLifecycle() - callback exception isolation (US3)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it('does not let a throwing onCall/onResult prevent a successful call from resolving normally', async () => {
    const call = makeCall({
      onCall: () => {
        throw new Error('onCall boom');
      },
      onResult: () => {
        throw new Error('onResult boom');
      },
    });

    await expect(
      call.run('Test.op', async () => ({ usedFallback: false, value: 1 }))
    ).resolves.toEqual({ usedFallback: false, value: 1 });
  });

  it('does not let a throwing onCall/onError prevent a failing call from rejecting with its original error', async () => {
    const originalError = new ModelUnavailableError('down');
    const call = makeCall({
      onCall: () => {
        throw new Error('onCall boom');
      },
      onError: () => {
        throw new Error('onError boom');
      },
    });

    await expect(
      call.run('Test.op', async () => {
        throw originalError;
      })
    ).rejects.toBe(originalError);
  });
});

describe('GroundedCall.withLifecycle() - no callbacks configured (FR-009)', () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it("resolves with fn()'s own value, unaffected, when no callbacks are configured", async () => {
    const call = makeCall();
    await expect(
      call.run('Test.op', async () => ({ usedFallback: false, value: 'ok' }))
    ).resolves.toEqual({ usedFallback: false, value: 'ok' });
  });

  it("rejects with fn()'s own error, unaffected, when no callbacks are configured", async () => {
    const originalError = new InvalidModelOutputError('bad');
    const call = makeCall();
    await expect(
      call.run('Test.op', async () => {
        throw originalError;
      })
    ).rejects.toBe(originalError);
  });
});

import {
  ModelUnavailableError,
  ContextTooLargeError,
  InvalidModelOutputError,
  ProviderError,
} from './errors.js';

/** Classification of an operational call failure, reported to `onError` (spec FR-004). */
export type LifecycleErrorType =
  'model-unavailable' | 'invalid-output' | 'context-too-large' | 'provider-error' | 'unknown';

/** Delivered to `onCall`, before the call reaches the model (spec FR-002). */
export interface CallEvent {
  callId: string;
  operation: string;
}

/** Delivered to `onResult`, after a call succeeds (spec FR-003). */
export interface ResultEvent {
  callId: string;
  operation: string;
  durationMs: number;
  usedFallback: boolean;
}

/** Delivered to `onError`, after a call fails (spec FR-004). */
export interface ErrorEvent {
  callId: string;
  operation: string;
  durationMs: number;
  errorType: LifecycleErrorType;
  error: unknown;
}

/**
 * Maps a thrown error to one of the known operational categories. Anything that
 * isn't one of the library's own operational error types (e.g. a synchronous
 * usage/validation error thrown before the model is reached) classifies as
 * `'unknown'`, so `onError` can always report *some* classification (research.md
 * Decision 3).
 */
export function classifyOperationalError(error: unknown): LifecycleErrorType {
  if (error instanceof ModelUnavailableError) return 'model-unavailable';
  if (error instanceof InvalidModelOutputError) return 'invalid-output';
  if (error instanceof ContextTooLargeError) return 'context-too-large';
  if (error instanceof ProviderError) return 'provider-error';
  return 'unknown';
}

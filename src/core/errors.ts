/** Technical failure calling the model: unavailability, timeout, communication error (FR-010). */
export class ModelUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ModelUnavailableError';
  }
}

/** Provided context exceeds the model's processable limit, with safety margin (FR-011). */
export class ContextTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextTooLargeError';
  }
}

/** Model response fails structured-output schema validation, or is refused (FR-012). */
export class InvalidModelOutputError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InvalidModelOutputError';
  }
}

export type ProviderErrorCategory =
  'selection' | 'auth' | 'unavailable' | 'output-invalid' | 'unsupported-capability';

/** Normalized library-level error for provider selection and execution failures. */
export class ProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly providerId?: string;
  readonly remediationHint?: string;

  constructor(
    message: string,
    options: {
      category: ProviderErrorCategory;
      providerId?: string;
      remediationHint?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = 'ProviderError';
    this.category = options.category;
    this.providerId = options.providerId;
    this.remediationHint = options.remediationHint;
  }
}

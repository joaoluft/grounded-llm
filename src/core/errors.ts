/** Technical failure calling the model: unavailability, timeout, communication error (FR-010). */
export class ModelUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelUnavailableError";
  }
}

/** Provided context exceeds the model's processable limit, with safety margin (FR-011). */
export class ContextTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextTooLargeError";
  }
}

/** Model response fails structured-output schema validation, or is refused (FR-012). */
export class InvalidModelOutputError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InvalidModelOutputError";
  }
}

// src/core/GroundedCall.ts
import OpenAI from "openai";
import { LengthFinishReasonError, ContentFilterFinishReasonError } from "openai/error.mjs";

// src/core/errors.ts
var ModelUnavailableError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "ModelUnavailableError";
  }
};
var ContextTooLargeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ContextTooLargeError";
  }
};
var InvalidModelOutputError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "InvalidModelOutputError";
  }
};

// src/core/contextWindow.ts
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
var KNOWN_MODEL_LIMITS = {
  "gpt-4o-mini": 128e3,
  "gpt-4o": 128e3,
  "gpt-4-turbo": 128e3
};
var DEFAULT_MODEL_LIMIT = 128e3;
var SAFETY_MARGIN_RATIO = 0.9;
function getMaxContextTokens(model) {
  const rawLimit = KNOWN_MODEL_LIMITS[model] ?? DEFAULT_MODEL_LIMIT;
  return Math.floor(rawLimit * SAFETY_MARGIN_RATIO);
}

// src/core/GroundedCall.ts
var GroundedCall = class {
  client;
  model;
  fallbackValue;
  temperature;
  maxContextTokens;
  constructor(config) {
    if (!config.fallbackValue || config.fallbackValue.trim().length === 0) {
      throw new Error("GroundedCall: `fallbackValue` is required and must be a non-empty string.");
    }
    this.fallbackValue = config.fallbackValue;
    if (config.client) {
      this.client = config.client;
      if (config.model !== void 0 && config.model.trim().length === 0) {
        throw new Error("GroundedCall: `model` must not be an empty string.");
      }
      this.model = config.model ?? "gpt-4o-mini";
    } else {
      if (config.model !== void 0 && config.model.trim().length === 0) {
        throw new Error("GroundedCall: `model` must not be an empty string.");
      }
      this.model = config.model ?? "gpt-4o-mini";
      const apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"];
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(
          "GroundedCall: no `apiKey` provided and OPENAI_API_KEY is not set in the environment."
        );
      }
      this.client = new OpenAI({ apiKey });
    }
    this.temperature = config.temperature ?? 0;
    this.maxContextTokens = config.maxContextTokens ?? getMaxContextTokens(this.model);
  }
  /** Throws ContextTooLargeError (FR-011) without calling the model. */
  assertContextWithinLimit(promptText) {
    const estimated = estimateTokens(promptText);
    if (estimated > this.maxContextTokens) {
      throw new ContextTooLargeError(
        `Estimated prompt size (~${estimated} tokens) exceeds the configured limit of ${this.maxContextTokens} tokens for model "${this.model}".`
      );
    }
  }
  /**
   * Calls the model with structured-output parsing, translating failures into the
   * distinct operational-error types (FR-010, FR-012). Never retries automatically.
   */
  async callModel(params) {
    let completion;
    try {
      completion = await this.client.beta.chat.completions.parse(params);
    } catch (error) {
      if (error instanceof LengthFinishReasonError || error instanceof ContentFilterFinishReasonError) {
        throw new InvalidModelOutputError(
          `Model response failed structured output validation: ${error.message}`,
          { cause: error }
        );
      }
      throw new ModelUnavailableError(
        `Call to the OpenAI model failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new InvalidModelOutputError(`Model refused to respond: ${message.refusal}`);
    }
    if (!message || message.parsed === null || message.parsed === void 0) {
      throw new InvalidModelOutputError("Model response could not be parsed against the expected schema.");
    }
    return message.parsed;
  }
};

// src/generators/GroundedGenerator.ts
import { zodResponseFormat } from "openai/helpers/zod.mjs";

// src/generators/schema.ts
import { z } from "zod";
var groundedGenerationSchema = z.object({
  extracted_facts: z.array(z.string()),
  sufficient_context: z.boolean(),
  reasoning: z.string(),
  final_answer: z.string()
});

// src/generators/GroundedGenerator.ts
var SYSTEM_PROMPT = `You answer questions using ONLY the provided context.

Follow these steps:
1. Extract the literal excerpts from the context that are relevant to the question, verbatim \u2014 never paraphrase.
2. Decide, based only on those excerpts, whether the context is sufficient to answer the question safely.
   - If different parts of the context contradict each other on the same fact, treat this as insufficient.
   - If the context is only partially related to the question, judge whether that partial information is enough
     to answer safely; if not, treat it as insufficient.
3. If sufficient, write a final answer using only information present in the extracted excerpts \u2014 never add
   outside knowledge.
4. If not sufficient, or if no relevant excerpt exists, set sufficient_context to false and leave final_answer
   empty \u2014 a fallback will be used instead of your answer.

Always explain your reasoning, connecting the extracted excerpts to your sufficiency decision and (when
applicable) to the final answer.`;
var GroundedGenerator = class extends GroundedCall {
  constructor(config) {
    super(config);
  }
  async generate(request) {
    if (!request.question || request.question.trim().length === 0) {
      throw new Error("GroundedGenerator: `question` must be a non-empty string.");
    }
    if (!request.context || request.context.trim().length === 0) {
      return this.buildFallbackResult("Context was empty or blank.");
    }
    const userPrompt = this.buildUserPrompt(request);
    this.assertContextWithinLimit(SYSTEM_PROMPT + userPrompt);
    const output = await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: zodResponseFormat(groundedGenerationSchema, "grounded_generation"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });
    if (!output.sufficient_context || output.extracted_facts.length === 0) {
      return this.buildFallbackResult(output.reasoning, output.extracted_facts);
    }
    return {
      finalAnswer: output.final_answer,
      usedFallback: false,
      extractedFacts: output.extracted_facts,
      reasoning: output.reasoning
    };
  }
  buildFallbackResult(reasoning, extractedFacts = []) {
    return {
      finalAnswer: this.fallbackValue,
      usedFallback: true,
      extractedFacts,
      reasoning
    };
  }
  buildUserPrompt(request) {
    return `Context:
${request.context}

Question: ${request.question}`;
  }
};
export {
  ContextTooLargeError,
  GroundedCall,
  GroundedGenerator,
  InvalidModelOutputError,
  ModelUnavailableError
};
//# sourceMappingURL=index.js.map
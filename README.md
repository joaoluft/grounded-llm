# grounded-llm

TypeScript library to reduce hallucination in LLM-generated responses, by forcing literal
fact extraction and an explicit sufficiency check before generating a final answer.

## GroundedGenerator

Generates a final answer strictly grounded in retrieved context, or falls back to a
developer-configured value when the context is insufficient — instead of inventing an
answer.

```ts
import { GroundedGenerator } from "grounded-llm";

const generator = new GroundedGenerator({
  fallbackValue: "Sorry, I don't have enough information to answer that.",
  // Optional: model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, or an already-configured `client`
  // instance from the `openai` package.
});

const result = await generator.generate({
  context: "Paris is the capital of France.",
  question: "What is the capital of France?",
});

console.log(result.usedFallback);   // false
console.log(result.finalAnswer);    // "Paris is the capital of France."
console.log(result.extractedFacts); // ["Paris is the capital of France."]
console.log(result.reasoning);      // explanation connecting facts to the answer
```

`GroundedGenerator` is standalone — it depends only on the official `openai` client, so
it can be plugged into any pipeline (LangGraph, a manual chain, or a direct call) without
requiring any third-party types.

### Error handling

`generate()` throws one of three distinct operational errors (none of which are retried
automatically — retry policy is the caller's responsibility):

- `ModelUnavailableError` — technical failure calling the model (network, timeout).
- `ContextTooLargeError` — the context exceeds the model's processable limit.
- `InvalidModelOutputError` — the model's response failed schema validation or was refused.

These are distinct from a normal result with `usedFallback: true`, which is a valid
outcome (insufficient context), not an error.

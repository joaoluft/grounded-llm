# Optional fallbackValue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fallbackValue` optional on `GroundedGenerator`, `GroundedEnricher`, and `GroundedExtractor`, and give `GroundedGenerator` a real "no fallback configured" mode where the model always produces a best-effort answer instead of a canned string.

**Architecture:** `GroundedCall`'s constructor validation relaxes from "fallbackValue required" to "fallbackValue optional, but non-empty if provided." `GroundedGenerator` selects between two system-prompt variants (with/without fallback) based on whether `fallbackValue` is configured, and skips the fallback substitution step when it's absent. `GroundedExtractor` gets equivalent treatment: a `shouldFallback` guard collapses to `false` whenever no `fallbackValue` was configured, so it always returns the model's raw (nullable) extraction instead. `GroundedEnricher` needs no logic changes — it never returned `fallbackValue` on any path.

**Tech Stack:** TypeScript, Vitest, Zod, openai SDK (`beta.chat.completions.parse`), tsup build.

## Global Constraints

- Backward compatible: every existing test with `fallbackValue` configured must keep passing unchanged.
- No new config flags — behavior is driven purely by whether `fallbackValue` is present (`!== undefined`).
- Response schemas (`groundedGenerationSchema`, `groundedEnrichmentSchema`, extraction schema) are unchanged.
- `temperature` default (0) and `identity`/`rules` composition behavior are unaffected.
- Run tests with `npm test` (vitest run) from the repo root after each step.

---

### Task 1: `GroundedCall` — optional `fallbackValue` in core types and constructor

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/GroundedCall.ts:23-28`
- Test: `tests/unit/core/GroundedCall.test.ts`

**Interfaces:**
- Produces: `GroundedCallConfig<TFallback = string>.fallbackValue?: TFallback` (was required). `GroundedCall<TFallback>.fallbackValue` becomes `protected readonly fallbackValue?: TFallback`. Later tasks read `this.fallbackValue !== undefined` to detect "fallback configured."

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/core/GroundedCall.test.ts`, inside the `"GroundedCall construction"` describe block (after the existing `"throws immediately when fallbackValue is missing"` test):

```ts
  it("constructs successfully without fallbackValue", () => {
    process.env["OPENAI_API_KEY"] = "test-key";
    expect(() => new TestableGroundedCall({} as GroundedCallConfig)).not.toThrow();
  });

  it("still throws when fallbackValue is explicitly an empty string", () => {
    process.env["OPENAI_API_KEY"] = "test-key";
    expect(() => new TestableGroundedCall({ fallbackValue: "" })).toThrow(/fallbackValue/i);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroundedCall.test.ts`
Expected: FAIL on `"constructs successfully without fallbackValue"` — current constructor throws `"fallbackValue is required..."` because `config.fallbackValue === undefined`.

- [ ] **Step 3: Update the type and constructor**

In `src/core/types.ts`, change:

```ts
  /** Required. No implicit default (FR-005). */
  fallbackValue: TFallback;
```

to:

```ts
  /** Optional. When omitted, the component must produce a real result instead of a canned fallback. */
  fallbackValue?: TFallback;
```

In `src/core/GroundedCall.ts`, change the field declaration:

```ts
  protected readonly fallbackValue: TFallback;
```

to:

```ts
  protected readonly fallbackValue?: TFallback;
```

And change the constructor's validation block:

```ts
    const isEmptyString = typeof config.fallbackValue === "string" && config.fallbackValue.trim().length === 0;
    if (config.fallbackValue === undefined || config.fallbackValue === null || isEmptyString) {
      throw new Error("GroundedCall: `fallbackValue` is required and must not be empty.");
    }
    this.fallbackValue = config.fallbackValue;
```

to:

```ts
    const isEmptyString = typeof config.fallbackValue === "string" && config.fallbackValue.trim().length === 0;
    if (config.fallbackValue === null || isEmptyString) {
      throw new Error("GroundedCall: `fallbackValue`, when provided, must not be empty.");
    }
    this.fallbackValue = config.fallbackValue;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- GroundedCall.test.ts`
Expected: PASS (all tests, including the two new ones and the pre-existing empty-string test).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — `GroundedGenerator`/`GroundedEnricher`/`GroundedExtractor` all still construct with `fallbackValue` configured exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/GroundedCall.ts tests/unit/core/GroundedCall.test.ts
git commit -m "feat: make fallbackValue optional in GroundedCall"
```

---

### Task 2: `GroundedGenerator` — free-answer mode when no fallback is configured

**Files:**
- Modify: `src/generators/GroundedGenerator.ts`
- Test: `tests/unit/generators/GroundedGenerator.test.ts`

**Interfaces:**
- Consumes: `this.fallbackValue` from `GroundedCall` (Task 1), now `string | undefined`.
- Produces: no change to `GenerationRequest`, `GroundedCallResult`, or `groundedGenerationSchema` shapes. Behavior only.

- [ ] **Step 1: Write the failing tests**

Add a new describe block to `tests/unit/generators/GroundedGenerator.test.ts` (after the existing `"GroundedGenerator - fallback when context is insufficient (US2)"` block):

```ts
describe("GroundedGenerator - free-answer mode when no fallbackValue is configured", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("returns the model's own answer when context is insufficient and no fallback is configured", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found in the context.",
      final_answer: "I couldn't find that in the context, but generally speaking, Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({
      context: "Completely unrelated text.",
      question: "What is the capital of France?",
    });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe(
      "I couldn't find that in the context, but generally speaking, Paris is the capital of France."
    );
  });

  it("still calls the model when context is empty/blank and no fallback is configured", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No context was provided.",
      final_answer: "I don't have any context, but Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({ context: "   ", question: "What is the capital of France?" });

    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe("I don't have any context, but Paris is the capital of France.");
  });

  it("sends the no-fallback prompt variant instructing the model to never leave final_answer empty", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "r",
      final_answer: "a",
    });

    const generator = new GroundedGenerator({});
    await generator.generate({ context: "irrelevant", question: "q?" });

    const sentSystemMessage = parseMock.mock.calls[0][0].messages[0].content as string;
    expect(sentSystemMessage).toContain("Never leave final_answer empty");
  });

  it("still returns the model's answer when sufficient_context is true and no fallback is configured", async () => {
    mockParsedResponse({
      extracted_facts: ["Paris is the capital of France."],
      sufficient_context: true,
      reasoning: "Directly stated.",
      final_answer: "Paris is the capital of France.",
    });

    const generator = new GroundedGenerator({});
    const result = await generator.generate({
      context: "Paris is the capital of France.",
      question: "What is the capital of France?",
    });

    expect(result.usedFallback).toBe(false);
    expect(result.finalAnswer).toBe("Paris is the capital of France.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroundedGenerator.test.ts`
Expected: FAIL — `new GroundedGenerator({})` currently throws (`fallbackValue` was required before Task 1, and even after Task 1 the generator still short-circuits empty context to a fallback call and never calls the model without one, and the prompt has no no-fallback variant).

- [ ] **Step 3: Implement the conditional prompt and flow**

Replace the whole content of `src/generators/GroundedGenerator.ts` with:

```ts
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { GroundedCall } from "../core/GroundedCall.js";
import type { GroundedCallConfig, GroundedCallResult } from "../core/types.js";
import { groundedGenerationSchema, type GroundedGenerationOutput } from "./schema.js";

export interface GenerationRequest {
  context: string;
  question: string;
}

const BASE_SYSTEM_PROMPT = `You answer questions using ONLY the provided context.

Follow these steps:
1. Extract the literal excerpts from the context that are relevant to the question, verbatim — never paraphrase.
2. Decide, based only on those excerpts, whether the context is sufficient to answer the question safely.
   - If different parts of the context contradict each other on the same fact, treat this as insufficient.
   - If the context is only partially related to the question, judge whether that partial information is enough
     to answer safely; if not, treat it as insufficient.
3. If sufficient, write a final answer using only information present in the extracted excerpts — never add
   outside knowledge.
4. `;

const WITH_FALLBACK_STEP_4 = `If not sufficient, or if no relevant excerpt exists, set sufficient_context to false and leave final_answer
empty — a fallback will be used instead of your answer.`;

const WITHOUT_FALLBACK_STEP_4 = `If not sufficient, or if no relevant excerpt exists, you must still answer as helpfully as possible —
using general knowledge, or asking the user a clarifying question. Never leave final_answer empty.
sufficient_context, extracted_facts, and reasoning must still truthfully reflect the grounding assessment.`;

const CLOSING_INSTRUCTIONS = `

Always explain your reasoning, connecting the extracted excerpts to your sufficiency decision and (when
applicable) to the final answer.`;

function buildSystemPromptBase(hasFallback: boolean): string {
  return BASE_SYSTEM_PROMPT + (hasFallback ? WITH_FALLBACK_STEP_4 : WITHOUT_FALLBACK_STEP_4) + CLOSING_INSTRUCTIONS;
}

/**
 * Generates a final answer strictly grounded in retrieved context, or defers to a
 * developer-configured fallback when the context is insufficient (spec.md US1/US2).
 * When no `fallbackValue` is configured, the model always produces a best-effort
 * answer instead (see docs/superpowers/specs/2026-07-16-optional-fallback-design.md).
 */
export class GroundedGenerator extends GroundedCall {
  constructor(config: GroundedCallConfig) {
    super(config);
  }

  async generate(request: GenerationRequest): Promise<GroundedCallResult> {
    if (!request.question || request.question.trim().length === 0) {
      throw new Error("GroundedGenerator: `question` must be a non-empty string.");
    }

    const hasFallback = this.fallbackValue !== undefined;

    if ((!request.context || request.context.trim().length === 0) && hasFallback) {
      return this.buildFallbackResult("Context was empty or blank.");
    }

    const userPrompt = this.buildUserPrompt(request);
    const systemPrompt = this.buildSystemPrompt(buildSystemPromptBase(hasFallback));
    this.assertContextWithinLimit(systemPrompt + userPrompt);

    const output = (await this.callModel({
      model: this.model,
      temperature: this.temperature,
      response_format: zodResponseFormat(groundedGenerationSchema, "grounded_generation"),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })) as GroundedGenerationOutput;

    if ((!output.sufficient_context || output.extracted_facts.length === 0) && hasFallback) {
      return this.buildFallbackResult(output.reasoning, output.extracted_facts);
    }

    return {
      finalAnswer: output.final_answer,
      usedFallback: false,
      extractedFacts: output.extracted_facts,
      reasoning: output.reasoning,
    };
  }

  private buildFallbackResult(reasoning: string, extractedFacts: string[] = []): GroundedCallResult {
    return {
      finalAnswer: this.fallbackValue as string,
      usedFallback: true,
      extractedFacts,
      reasoning,
    };
  }

  private buildUserPrompt(request: GenerationRequest): string {
    return `Context:\n${request.context}\n\nQuestion: ${request.question}`;
  }
}
```

Note: `buildFallbackResult` is only ever called when `hasFallback` is `true` (guarded at both call sites), so the `as string` cast is safe — `this.fallbackValue` is guaranteed defined there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- GroundedGenerator.test.ts`
Expected: PASS — all new and pre-existing tests green.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — including `GroundedGenerator.integration.test.ts`, `GroundedGenerator.traceability.evaluation.test.ts`, `GroundedGenerator.fallbackRate.evaluation.test.ts`, and the contract test `tests/contract/generators/GroundedGenerator.schema.test.ts` (schema itself is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/generators/GroundedGenerator.ts tests/unit/generators/GroundedGenerator.test.ts
git commit -m "feat: GroundedGenerator answers freely when no fallbackValue is configured"
```

---

### Task 3: `GroundedExtractor` — free-extraction mode when no fallback is configured

**Files:**
- Modify: `src/generators/GroundedExtractor.ts`
- Test: `tests/unit/generators/GroundedExtractor.test.ts`

**Interfaces:**
- Consumes: `this.fallbackValue` from `GroundedCall<ExtractionData<Fields>>` (Task 1), now `ExtractionData<Fields> | undefined`.
- Produces: no change to `GroundedExtractionResult<Fields>`, `ExtractionData<Fields>`, or the extraction schema. `GroundedExtractionConfig.fallbackValue` becomes optional.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/generators/GroundedExtractor.test.ts` (after the existing `"GroundedExtractor - no extractable information (US2, FR-206)"` block):

```ts
describe("GroundedExtractor - free-extraction mode when no fallbackValue is configured", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("constructs successfully without fallbackValue", () => {
    expect(() => new GroundedExtractor({ fields })).not.toThrow();
  });

  it("returns nulled-out data instead of throwing when nothing is extracted", async () => {
    mockParsedResponse({ name: null, email: null, reasoning: "nothing found" });

    const extractor = new GroundedExtractor({ fields });
    const result = await extractor.extract({ message: "The weather is nice today." });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: null, email: null });
  });

  it("ignores strict and returns partial data instead of falling back", async () => {
    mockParsedResponse({ name: "Ada Lovelace", email: null, reasoning: "only name found" });

    const extractor = new GroundedExtractor({ fields, strict: true });
    const result = await extractor.extract({ message: "I'm Ada Lovelace" });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: "Ada Lovelace", email: null });
  });

  it("returns nulled-out data for an empty/blank message without calling the model", async () => {
    const extractor = new GroundedExtractor({ fields });
    const result = await extractor.extract({ message: "   " });

    expect(result.usedFallback).toBe(false);
    expect(result.data).toEqual({ name: null, email: null });
    expect(parseMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroundedExtractor.test.ts`
Expected: FAIL — `new GroundedExtractor({ fields })` throws because `fallbackValue` is currently required (both by `GroundedExtractionConfig`'s type/runtime shape and by the constructor `if (!config.fields)`/base-class check), and `extract()` unconditionally returns `this.fallbackValue` on the empty/all-null paths.

- [ ] **Step 3: Update the config type and extraction logic**

In `src/generators/GroundedExtractor.ts`, change the config interface field:

```ts
  /** Required whole-object fallback, same shape as `fields` (FR-205). */
  fallbackValue: ExtractionData<Fields>;
```

to:

```ts
  /** Optional whole-object fallback, same shape as `fields` (FR-205). When omitted, `extract()` always returns the model's raw (nullable) extraction instead. */
  fallbackValue?: ExtractionData<Fields>;
```

Then replace the body of `extract()` from the `fieldKeys`/`allNull`/`someNull` block onward, and update `buildFallbackResult`:

```ts
    const fieldKeys = Object.keys(this.fields) as (keyof Fields)[];
    const values = fieldKeys.map((key) => data[key]);
    const allNull = values.every((value) => value === null);
    const someNull = values.some((value) => value === null);
    const hasFallback = this.fallbackValue !== undefined;

    const shouldFallback = hasFallback && (allNull || (someNull && this.strict));
    if (shouldFallback) {
      return this.buildFallbackResult(reasoning);
    }

    return { data, usedFallback: false, reasoning };
  }

  private buildEmptyData(): ExtractionData<Fields> {
    const fieldKeys = Object.keys(this.fields) as (keyof Fields)[];
    return Object.fromEntries(fieldKeys.map((key) => [key, null])) as ExtractionData<Fields>;
  }

  private buildFallbackResult(reasoning: string): GroundedExtractionResult<Fields> {
    if (this.fallbackValue !== undefined) {
      return { data: this.fallbackValue, usedFallback: true, reasoning };
    }
    return { data: this.buildEmptyData(), usedFallback: false, reasoning };
  }
}
```

And update the empty-message short-circuit at the top of `extract()`:

```ts
    if (!request.message || request.message.trim().length === 0) {
      return this.buildFallbackResult("Message was empty or blank.");
    }
```

(this line is unchanged — it already delegates to `buildFallbackResult`, which now handles both cases).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- GroundedExtractor.test.ts`
Expected: PASS — all new and pre-existing tests green (pre-existing tests all configure `fallbackValue`, so `hasFallback` is `true` for them and behavior is unchanged).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — including `tests/contract/generators/GroundedExtractor.schema.test.ts`, `GroundedExtractor.strictMode.evaluation.test.ts`, `GroundedExtractor.traceability.evaluation.test.ts`, `GroundedExtractor.fallbackRate.evaluation.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/generators/GroundedExtractor.ts tests/unit/generators/GroundedExtractor.test.ts
git commit -m "feat: GroundedExtractor returns raw extraction when no fallbackValue is configured"
```

---

### Task 4: `GroundedEnricher` — confirm no behavior change with optional fallback

**Files:**
- Test: `tests/unit/generators/GroundedEnricher.test.ts`

**Interfaces:**
- Consumes: `GroundedCallConfig` (Task 1) — `GroundedEnricher`'s own source file needs no modification since it never reads `this.fallbackValue` on any path.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/generators/GroundedEnricher.test.ts` (open the file first to match its existing `mockParsedResponse`/describe conventions, then add a new describe block at the end):

```ts
describe("GroundedEnricher - no fallbackValue configured", () => {
  beforeEach(() => {
    parseMock.mockReset();
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("constructs successfully without fallbackValue", () => {
    expect(() => new GroundedEnricher({})).not.toThrow();
  });

  it("still returns baseContent unchanged when context is insufficient, with no fallbackValue configured", async () => {
    mockParsedResponse({
      extracted_facts: [],
      sufficient_context: false,
      reasoning: "No relevant information found.",
      enriched_text: "",
    });

    const enricher = new GroundedEnricher({});
    const result = await enricher.generate({
      baseContent: "Thanks for your order!",
      context: "Completely unrelated text.",
    });

    expect(result.usedFallback).toBe(true);
    expect(result.finalAnswer).toBe("Thanks for your order!");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- GroundedEnricher.test.ts`
Expected: FAIL — before Task 1, `fallbackValue` was required, so `new GroundedEnricher({})` throws. After Task 1 alone (without this task) the test would already pass, since no production code in `GroundedEnricher.ts` needs to change — this step confirms that.

- [ ] **Step 3: No production code change needed**

`GroundedEnricher.ts` already returns `baseContent` unchanged (never `this.fallbackValue`) on the insufficient-context path — inherited optionality from Task 1 is sufficient. Re-run the test to confirm.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- GroundedEnricher.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS (full suite, all files).

- [ ] **Step 6: Commit**

```bash
git add tests/unit/generators/GroundedEnricher.test.ts
git commit -m "test: confirm GroundedEnricher is unaffected by optional fallbackValue"
```

---

### Task 5: README — document optional `fallbackValue` (EN/PT)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the English section**

In the `## English` section, in the shared "Generators" intro paragraph, change:

```
All three share the same principles: mandatory fallback at construction, structured
output via schema, `temperature` zero by default, and operational errors
```

to:

```
All three share the same principles: optional fallback at construction (see below),
structured output via schema, `temperature` zero by default, and operational errors
```

Immediately after that paragraph (before the `identity`/`rules` bullet list), add:

```markdown
`fallbackValue` is optional. When configured, it's the canned value returned in place
of the model's output whenever the component judges its own result unsafe to return
(insufficient context, nothing extractable). When omitted:

- `GroundedGenerator` and `GroundedEnricher` always let the model produce a real
  answer — `GroundedGenerator` falls back to a best-effort answer (general knowledge,
  or a clarifying question) instead of an empty result; `GroundedEnricher`'s behavior
  is unchanged either way, since it already returns `baseContent` unchanged on
  insufficient context rather than a configured fallback.
- `GroundedExtractor` always returns the model's raw extraction (`null` for fields it
  couldn't find), ignoring `strict`, instead of substituting a fallback object.
```

In the `GroundedGenerator` code example's comment, change:

```
  // Optional: model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, or an already-configured `client`
  // instance from the `openai` package. Also accepts identity/rules (see "Generators").
```

to:

```
  // Optional: fallbackValue (see "Generators" above for what happens when it's
  // omitted), model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, or an already-configured `client`
  // instance from the `openai` package. Also accepts identity/rules.
```

- [ ] **Step 2: Update the Portuguese section**

In the `## Português` section, mirror the same two edits. Change:

```
Os três compartilham os mesmos princípios: fallback obrigatório na construção, saída
estruturada via schema, `temperature` zero por padrão, e erros operacionais
```

to:

```
Os três compartilham os mesmos princípios: fallback opcional na construção (veja
abaixo), saída estruturada via schema, `temperature` zero por padrão, e erros
operacionais
```

Add after that paragraph:

```markdown
`fallbackValue` é opcional. Quando configurado, é o valor fixo retornado no lugar da
saída do modelo sempre que o componente julga seu próprio resultado inseguro para
retornar (contexto insuficiente, nada extraível). Quando omitido:

- `GroundedGenerator` e `GroundedEnricher` sempre deixam o modelo produzir uma
  resposta real — o `GroundedGenerator` recorre a uma resposta best-effort
  (conhecimento geral, ou uma pergunta de esclarecimento) em vez de um resultado
  vazio; o comportamento do `GroundedEnricher` não muda de qualquer forma, já que ele
  já retorna o `baseContent` inalterado quando o contexto é insuficiente, em vez de um
  fallback configurado.
- `GroundedExtractor` sempre retorna a extração bruta do modelo (`null` nos campos não
  encontrados), ignorando `strict`, em vez de substituir por um objeto de fallback.
```

And in the `GroundedGenerator` PT code example's comment, change:

```
  // Opcional: model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, ou uma instância `client` já
  // configurada do pacote `openai`. Também aceita identity/rules (ver "Generators").
```

to:

```
  // Opcional: fallbackValue (ver "Generators" acima para o que acontece quando
  // omitido), model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, ou uma instância `client` já
  // configurada do pacote `openai`. Também aceita identity/rules.
```

- [ ] **Step 3: Verify the README renders sensibly**

Run: `grep -n "fallbackValue é opcional\|fallbackValue is optional" README.md`
Expected: two matches, one per language section.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document optional fallbackValue and its effect on each component"
```

---

## Self-Review Notes

- **Spec coverage:** Section A → Task 1. Section B → Task 2. Section C → Task 4. Section D → Task 3. Testing section → covered across Tasks 1-4. Documentation section → Task 5.
- **Type consistency:** `GroundedCallConfig.fallbackValue?`, `GroundedCall.fallbackValue?`, `GroundedExtractionConfig.fallbackValue?` all agree. `buildFallbackResult` signatures match their call sites in both `GroundedGenerator` and `GroundedExtractor`.
- **No placeholders:** every step has literal code, not descriptions.

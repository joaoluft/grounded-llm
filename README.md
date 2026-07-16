<p align="center">
  <img src="https://raw.githubusercontent.com/joaoluft/grounded-llm/main/logo.png" alt="Grounded LLM mascot — a dinosaur reading a book" width="320" />
</p>

<h1 align="center">grounded-llm</h1>

<p align="center">
  <a href="#english">English</a> · <a href="#português">Português</a>
</p>

<p align="center">
  ⚠️ <strong>This version works exclusively with the OpenAI API.</strong><br/>
  ⚠️ <strong>Esta versão funciona exclusivamente com a API da OpenAI.</strong>
</p>

---

## English

TypeScript library to reduce hallucination in LLM-generated responses, by forcing
literal fact extraction and an explicit sufficiency check before generating a final
answer.

> **This version supports OpenAI exclusively.** The component uses the official
> `openai` client internally (injected by you or created from an `apiKey`); no other
> model provider is supported in this release.

### How it fights hallucination: chain-of-thought grounding

Every component in this library forces the model through the same explicit
**chain-of-thought** sequence instead of asking for a final answer directly:

1. **Extract** — the model pulls the literal, verbatim excerpts from the context that
   are relevant to the request. No paraphrasing is allowed at this step.
2. **Judge sufficiency** — using only those excerpts, the model explicitly decides
   whether the context is enough to respond safely (contradictions or partial matches
   count as insufficient).
3. **Answer or fall back** — only if the context was judged sufficient does the model
   write a final answer, and it may use only what was extracted in step 1. Otherwise,
   the call returns the developer-configured fallback instead of letting the model
   invent something plausible.
4. **Explain** — the model must always return `reasoning`, an explanation that ties
   the extracted excerpts to the sufficiency decision and (when applicable) to the
   final answer.

This forced extract → judge → answer → explain pipeline, enforced through structured
output (schema-validated, not just a prompting convention), is what makes hallucination
structurally harder: the model cannot skip straight to a confident-sounding answer
without first grounding it in literal text it can point to. Every result exposes this
reasoning chain via `result.extractedFacts` and `result.reasoning`, so you can inspect
*why* the model answered — or refused to — instead of trusting a black-box output.

### Generators

The library offers three components, each for a different context-grounded LLM call
scenario:

| Component | Use case | Method |
|---|---|---|
| [`GroundedGenerator`](#groundedgenerator) | Generate the final answer to the user from retrieved context | `.generate({ context, question })` |
| [`GroundedEnricher`](#groundedenricher) | Enrich an existing base text with retrieved context | `.generate({ baseContent, context })` |
| [`GroundedExtractor`](#groundedextractor) | Extract a structured object (fields you define) from the user message | `.extract({ message })` |

All three share the same principles: mandatory fallback at construction, structured
output via schema, `temperature` zero by default, and operational errors
(`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`) always
distinct from a fallback result.

All three also accept, at construction, two optional parameters to customize the
model's behavior for that call:

- **`identity`** — the model's role/objective for this call (e.g. "You are the
  support assistant for Acme Corp.").
- **`rules`** — additional rules constraining the call (e.g. tone, style).

Both are appended as an extra section in the same system prompt, **always after**
the component's built-in grounding/anti-hallucination instructions — they complement
persona and tone, but never override the grounding rules.

### GroundedGenerator

Generates a final answer strictly grounded in retrieved context, or falls back to a
developer-configured value when the context is insufficient — instead of inventing an
answer.

```ts
import { GroundedGenerator } from "grounded-llm";

const generator = new GroundedGenerator({
  fallbackValue: "Sorry, I don't have enough information to answer that.",
  // Optional: model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, or an already-configured `client`
  // instance from the `openai` package. Also accepts identity/rules (see "Generators").
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

#### Error handling

`generate()` throws one of three distinct operational errors (none of which are retried
automatically — retry policy is the caller's responsibility):

- `ModelUnavailableError` — technical failure calling the model (network, timeout).
- `ContextTooLargeError` — the context exceeds the model's processable limit.
- `InvalidModelOutputError` — the model's response failed schema validation or was refused.

These are distinct from a normal result with `usedFallback: true`, which is a valid
outcome (insufficient context), not an error.

### GroundedEnricher

Enriches an existing base text with retrieved context (e.g., via RAG) — useful when
you already have a template/draft response and want to add dynamic information to it,
instead of generating a response from scratch.

```ts
import { GroundedEnricher } from "grounded-llm";

const enricher = new GroundedEnricher({
  fallbackValue: "N/A", // required for API consistency; never actually returned in normal use (see note below)
  // Also accepts identity/rules, plus the same config options as GroundedGenerator.
});

const result = await enricher.generate({
  baseContent: "Thanks for your order!",
  context: "Orders ship within 3 business days.",
});

console.log(result.usedFallback);   // false
console.log(result.finalAnswer);    // "Thanks for your order! Orders ship within 3 business days."
console.log(result.extractedFacts); // ["Orders ship within 3 business days."]
console.log(result.reasoning);      // explanation connecting facts to the enrichment
```

**Fallback semantics differ from `GroundedGenerator`**: when the context is
insufficient to enrich safely, `GroundedEnricher` returns `baseContent`
**unchanged** (with `usedFallback: true`) — never `fallbackValue`. `fallbackValue` is
required at construction only for consistency with the other components in the
family; it's never returned by any success path. An empty/blank `baseContent` is
treated as invalid usage and throws immediately, without calling the model.

### GroundedExtractor

Extracts a structured object with fields you define from a user message — useful for
the "JSON mode" scenarios common in chatbots (name, email, intent, etc.), without
requiring a closed set of actions or logprob-based confidence (that's the future
`GroundedDecider`'s job).

```ts
import { GroundedExtractor } from "grounded-llm";
import { z } from "zod";

const extractor = new GroundedExtractor({
  fields: { name: z.string(), email: z.string() },
  fallbackValue: { name: null, email: null }, // whole object, same shape as `fields`
  // Optional: strict (default false) — see below. Also accepts identity/rules.
});

const result = await extractor.extract({
  message: "Hi, I'm Ada Lovelace, ada@example.com",
});

console.log(result.usedFallback); // false
console.log(result.data);         // { name: "Ada Lovelace", email: "ada@example.com" }
console.log(result.reasoning);
```

**Partial extraction and `strict` mode**: if the message only supports part of the
fields, the default behavior (`strict: false`) returns the extracted fields with
`null` for the rest, without triggering `fallbackValue`. With `strict: true`, any
missing field triggers `fallbackValue` (whole object) instead of a partial result. If
no field can be safely extracted (or the message is empty), `fallbackValue` is
returned regardless of `strict`.

### Releasing

CI (`.github/workflows/ci.yml`) runs type-check, tests, and build on every push/PR to
`main`. Publishing to npm (`.github/workflows/release.yml`) is triggered by pushing a
`v*.*.*` tag:

```sh
npm version patch   # or minor / major — bumps package.json and creates a git tag
git push --follow-tags
```

The release workflow verifies the tag matches `package.json`'s version, then runs the
same build/test steps before publishing with npm provenance. Requires an `NPM_TOKEN`
secret (an npm Automation token) configured in the repository settings.

---

## Português

Biblioteca TypeScript para reduzir alucinação em respostas geradas por LLM, forçando
extração literal de fatos e uma checagem explícita de suficiência de contexto antes de
gerar a resposta final.

> **Nesta versão, o suporte é exclusivo à OpenAI.** O componente usa o client oficial
> `openai` internamente (injetado por você ou criado a partir de uma `apiKey`); não há
> suporte a outros provedores de modelo nesta release.

### Como o combate à alucinação funciona: chain-of-thought ancorado em contexto

Todos os componentes da biblioteca forçam o modelo a passar pela mesma sequência
explícita de **chain-of-thought** (cadeia de raciocínio), em vez de pedir a resposta
final diretamente:

1. **Extrair** — o modelo retira do contexto os trechos literais e relevantes para a
   solicitação, verbatim. Paráfrase não é permitida nesta etapa.
2. **Julgar suficiência** — usando apenas esses trechos extraídos, o modelo decide
   explicitamente se o contexto é suficiente para responder com segurança
   (contradições ou correspondências parciais contam como insuficientes).
3. **Responder ou usar fallback** — só se o contexto for julgado suficiente o modelo
   escreve uma resposta final, e ela só pode usar o que foi extraído no passo 1. Caso
   contrário, a chamada retorna o fallback configurado pelo desenvolvedor, em vez de
   deixar o modelo inventar algo plausível.
4. **Explicar** — o modelo sempre deve retornar `reasoning`, uma explicação que
   conecta os trechos extraídos à decisão de suficiência e (quando aplicável) à
   resposta final.

Esse pipeline forçado de extrair → julgar → responder → explicar, garantido via saída
estruturada (validada por schema, não apenas uma convenção de prompt), é o que torna a
alucinação estruturalmente mais difícil: o modelo não consegue pular direto para uma
resposta com aparência confiante sem antes ancorá-la em texto literal que ele pode
apontar. Todo resultado expõe essa cadeia de raciocínio via `result.extractedFacts` e
`result.reasoning`, permitindo inspecionar *por que* o modelo respondeu — ou se recusou
a responder — em vez de confiar em uma saída caixa-preta.

### Generators

A lib oferece três componentes, cada um para um cenário diferente de chamada LLM
ancorada em contexto:

| Componente | Uso | Método |
|---|---|---|
| [`GroundedGenerator`](#groundedgenerator-1) | Gerar a resposta final ao usuário a partir de contexto recuperado | `.generate({ context, question })` |
| [`GroundedEnricher`](#groundedenricher-1) | Enriquecer um texto-base existente com contexto recuperado | `.generate({ baseContent, context })` |
| [`GroundedExtractor`](#groundedextractor-1) | Extrair um objeto estruturado (campos definidos por você) da mensagem do usuário | `.extract({ message })` |

Os três compartilham os mesmos princípios: fallback obrigatório na construção, saída
estruturada via schema, `temperature` zero por padrão, e erros operacionais
(`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`) sempre
distintos de um resultado com fallback.

Os três também aceitam, na construção, dois parâmetros opcionais para customizar o
comportamento do modelo naquela chamada:

- **`identity`** — o papel/objetivo do modelo naquela chamada (ex: "Você é o
  assistente de suporte da Acme Corp.").
- **`rules`** — regras adicionais para restringir a chamada (ex: tom de voz, estilo).

Ambos são anexados como uma seção extra no mesmo system prompt, **sempre depois** das
instruções internas de ancoragem/anti-alucinação — eles complementam persona e tom,
mas nunca sobrescrevem as regras de grounding.

### GroundedGenerator

Gera uma resposta final estritamente ancorada no contexto recuperado, ou recorre a um
valor de fallback configurado pelo desenvolvedor quando o contexto é insuficiente — em
vez de inventar uma resposta.

```ts
import { GroundedGenerator } from "grounded-llm";

const generator = new GroundedGenerator({
  fallbackValue: "Desculpe, não tenho informação suficiente para responder isso.",
  // Opcional: model (default "gpt-4o-mini"), apiKey (default OPENAI_API_KEY),
  // temperature (default 0), maxContextTokens, ou uma instância `client` já
  // configurada do pacote `openai`. Também aceita identity/rules (ver "Generators").
});

const result = await generator.generate({
  context: "Paris é a capital da França.",
  question: "Qual é a capital da França?",
});

console.log(result.usedFallback);   // false
console.log(result.finalAnswer);    // "Paris é a capital da França."
console.log(result.extractedFacts); // ["Paris é a capital da França."]
console.log(result.reasoning);      // explicação conectando os fatos à resposta
```

O `GroundedGenerator` é standalone — depende apenas do client oficial `openai`, então
pode ser plugado em qualquer pipeline (LangGraph, uma chain manual, ou uma chamada
direta) sem exigir nenhum tipo de terceiros.

#### Tratamento de erros

`generate()` lança um de três erros operacionais distintos (nenhum deles é reexecutado
automaticamente — a política de retry é responsabilidade de quem consome a lib):

- `ModelUnavailableError` — falha técnica na chamada ao modelo (rede, timeout).
- `ContextTooLargeError` — o contexto excede o limite processável do modelo.
- `InvalidModelOutputError` — a resposta do modelo falhou na validação do schema ou foi recusada.

Esses erros são distintos de um resultado normal com `usedFallback: true`, que é um
desfecho válido (contexto insuficiente), não um erro.

### GroundedEnricher

Enriquece um texto-base existente com contexto recuperado (por exemplo, via RAG) — útil
quando você já tem uma resposta-template e quer adicionar informação dinâmica a ela, em
vez de gerar uma resposta do zero.

```ts
import { GroundedEnricher } from "grounded-llm";

const enricher = new GroundedEnricher({
  fallbackValue: "N/A", // exigido por consistência de API; nunca é retornado em uso normal (ver nota abaixo)
  // Também aceita identity/rules, além das mesmas opções de configuração do GroundedGenerator.
});

const result = await enricher.generate({
  baseContent: "Obrigado pelo seu pedido!",
  context: "Pedidos são entregues em até 3 dias úteis.",
});

console.log(result.usedFallback);   // false
console.log(result.finalAnswer);    // "Obrigado pelo seu pedido! Pedidos são entregues em até 3 dias úteis."
console.log(result.extractedFacts); // ["Pedidos são entregues em até 3 dias úteis."]
console.log(result.reasoning);      // explicação conectando os fatos ao enriquecimento
```

**Semântica de fallback diferente do `GroundedGenerator`**: quando o contexto é
insuficiente para enriquecer com segurança, o `GroundedEnricher` retorna o
`baseContent` **inalterado** (com `usedFallback: true`) — nunca o `fallbackValue`. O
`fallbackValue` é exigido na construção apenas por consistência com os demais
componentes da família; ele nunca é retornado em nenhum fluxo de sucesso. Um
`baseContent` vazio/em branco é tratado como uso inválido e lança uma exceção
imediatamente, sem chamar o modelo.

### GroundedExtractor

Extrai um objeto estruturado com campos definidos por você a partir de uma mensagem do
usuário — útil para os cenários de "JSON mode" de chatbots (nome, e-mail, intenção,
etc.), sem exigir um conjunto fechado de ações nem cálculo de confiança via logprob
(isso é responsabilidade do futuro `GroundedDecider`).

```ts
import { GroundedExtractor } from "grounded-llm";
import { z } from "zod";

const extractor = new GroundedExtractor({
  fields: { name: z.string(), email: z.string() },
  fallbackValue: { name: null, email: null }, // objeto completo, mesmo formato de `fields`
  // Opcional: strict (default false) — veja abaixo. Também aceita identity/rules.
});

const result = await extractor.extract({
  message: "Oi, sou a Ada Lovelace, ada@example.com",
});

console.log(result.usedFallback); // false
console.log(result.data);         // { name: "Ada Lovelace", email: "ada@example.com" }
console.log(result.reasoning);
```

**Extração parcial e modo `strict`**: se a mensagem preencher só parte dos campos, o
comportamento padrão (`strict: false`) retorna os campos extraídos e `null` nos
demais, sem acionar o `fallbackValue`. Com `strict: true`, qualquer campo ausente
aciona o `fallbackValue` (objeto completo) em vez de um resultado parcial. Se
nenhum campo puder ser extraído com segurança (ou a mensagem estiver vazia), o
`fallbackValue` é retornado independentemente do modo `strict`.

### Releases

O CI (`.github/workflows/ci.yml`) roda type-check, testes e build em todo push/PR para
`main`. A publicação no npm (`.github/workflows/release.yml`) é disparada ao subir uma
tag `v*.*.*`:

```sh
npm version patch   # ou minor / major — atualiza o package.json e cria a tag git
git push --follow-tags
```

O workflow de release confere se a tag bate com a versão do `package.json`, roda o
mesmo build/test novamente, e então publica com npm provenance. Requer um secret
`NPM_TOKEN` (token de automação do npm) configurado nas configurações do repositório.

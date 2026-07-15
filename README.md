<p align="center">
  <img src="https://raw.githubusercontent.com/joaoluft/grounded-llm/main/logo.png" alt="Grounded LLM mascot — a dinosaur reading a book" width="320" />
</p>

<h1 align="center">grounded-llm</h1>

<p align="center">
  <a href="#português">Português</a> · <a href="#english">English</a>
</p>

<p align="center">
  ⚠️ <strong>Esta versão funciona exclusivamente com a API da OpenAI.</strong><br/>
  ⚠️ <strong>This version works exclusively with the OpenAI API.</strong>
</p>

---

## Português

Biblioteca TypeScript para reduzir alucinação em respostas geradas por LLM, forçando
extração literal de fatos e uma checagem explícita de suficiência de contexto antes de
gerar a resposta final.

> **Nesta versão, o suporte é exclusivo à OpenAI.** O componente usa o client oficial
> `openai` internamente (injetado por você ou criado a partir de uma `apiKey`); não há
> suporte a outros provedores de modelo nesta release.

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
  // configurada do pacote `openai`.
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

---

## English

TypeScript library to reduce hallucination in LLM-generated responses, by forcing
literal fact extraction and an explicit sufficiency check before generating a final
answer.

> **This version supports OpenAI exclusively.** The component uses the official
> `openai` client internally (injected by you or created from an `apiKey`); no other
> model provider is supported in this release.

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

#### Error handling

`generate()` throws one of three distinct operational errors (none of which are retried
automatically — retry policy is the caller's responsibility):

- `ModelUnavailableError` — technical failure calling the model (network, timeout).
- `ContextTooLargeError` — the context exceeds the model's processable limit.
- `InvalidModelOutputError` — the model's response failed schema validation or was refused.

These are distinct from a normal result with `usedFallback: true`, which is a valid
outcome (insufficient context), not an error.

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

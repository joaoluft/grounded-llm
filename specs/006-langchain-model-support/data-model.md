# Data Model: Suporte a modelo LangChain no GroundedCall

**Feature**: 006-langchain-model-support | **Date**: 2026-07-16

Nenhuma mudança de forma em `GroundedCallResult`/`GroundedExtractionResult`. Esta
feature adiciona um campo de configuração (`GroundedCallConfig`) e uma abstração
interna nova (`ModelClient`) — sem introduzir nenhum tipo de dado público novo além
do próprio campo de config.

## GroundedCallConfig (ajuste — `core/types.ts`)

Usado por `GroundedGenerator`, `GroundedEnricher`, e (via composição própria) por
`GroundedExtractor`.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `langchainModel` | `BaseChatModel` (tipo de `@langchain/core/language_models/chat_models`, via `import type`) | Não | Chat model LangChain já configurado (credenciais, model id, temperatura) pelo desenvolvedor. Quando fornecido, é usado para todas as chamadas de modelo deste componente. |

> **Nota**: `GroundedExtractionConfig` (usado por `GroundedExtractor`, em
> `src/generators/grounded-extractor.ts`) é uma interface própria que duplica os
> campos de `GroundedCallConfig` em vez de estendê-la — o mesmo campo `langchainModel`
> precisa ser adicionado explicitamente a ela também (mesma situação já enfrentada
> pela feature 004 com `tone`), senão `GroundedExtractor` não consegue aceitar
> `langchainModel` (ver tasks.md T007).

### Exclusividade mútua (validada no constructor de `GroundedCall`)

| Combinação | Resultado |
|---|---|
| `langchainModel` sozinho | Modo LangChain — válido |
| `client`/`apiKey`/`model`/`temperature` sozinhos (sem `langchainModel`) | Modo standalone — válido, comportamento idêntico ao atual |
| `langchainModel` + qualquer um de `client`/`apiKey`/`model`/`temperature` | **Erro de configuração** lançado no constructor (FR-003) — os dois modos são mutuamente exclusivos |
| Nenhum dos dois | Modo standalone com defaults atuais (`OPENAI_API_KEY` do ambiente, model `gpt-4o-mini`) — comportamento inalterado |

`maxContextTokens` continua aceito em ambos os modos (não faz parte da exclusividade
mútua):

| Config | `maxContextTokens` informado | Comportamento |
|---|---|---|
| Modo standalone | Não | Derivado de `getMaxContextTokens(this.model)` (atual, inalterado) |
| Modo standalone | Sim | Respeita o valor informado (atual, inalterado) |
| Modo LangChain | Não | Default fixo de 128.000 tokens (FR-004) |
| Modo LangChain | Sim | Respeita o valor informado, mesma verificação de `ContextTooLargeError` (FR-005) |

`identity`, `rules`, `tone`, e `fallbackValue` continuam aceitos e com comportamento
idêntico em ambos os modos (FR-009) — não fazem parte da exclusividade mútua e não são
lidos pelo `ModelClient`.

## ModelClient (novo — interno, não exportado publicamente)

Abstração usada por `GroundedCall.callModel` para isolar o backend de chamada de
modelo do resto da lógica de cada componente.

```ts
interface ModelClient {
  parse(params: {
    model: string;
    temperature: number;
    response_format: /* retorno de zodResponseFormat(...) */;
    messages: { role: 'system' | 'user'; content: string }[];
  }): Promise<ParsedResult>; // mesma forma hoje retornada por client.beta.chat.completions.parse
}
```

Duas implementações:

| Implementação | Quando usada | Comportamento |
|---|---|---|
| `OpenAiModelClient` | Modo standalone | Exatamente a lógica hoje inline em `callModel`: chama `client.beta.chat.completions.parse(params)`, trata `LengthFinishReasonError`/`ContentFilterFinishReasonError`/refusal como já ocorre hoje |
| `LangChainModelClient` | Modo LangChain | Extrai `response_format.json_schema.schema`/`.name`; converte `messages` para tuplas `[[role, content], ...]`; chama `langchainModel.withStructuredOutput(schema, { name }).invoke(messages)`; empacota o resultado no mesmo formato de retorno esperado por `callModel` |

`GroundedCall.callModel` não muda de assinatura nem de comportamento observável —
passa a delegar a `this.modelClient.parse(params)` em vez de chamar
`this.client.beta.chat.completions.parse(params)` diretamente.

## Mapeamento de erros (ambos os `ModelClient`)

| Origem | Erro lançado |
|---|---|
| Falha na chamada ao modelo (rede/API, standalone ou LangChain) | `ModelUnavailableError` (inalterado) |
| Saída que não corresponde ao schema esperado, refusal, ou resposta vazia | `InvalidModelOutputError` (inalterado) |

Nenhum tipo de erro novo é introduzido (`src/core/errors.ts` não muda).

## GroundedCallResult / GroundedExtractionResult

Sem mudança de forma ou de significado de nenhum campo — o modo usado (standalone ou
LangChain) é inteiramente interno e não é exposto em nenhum campo do resultado
(FR-006, SC-003).

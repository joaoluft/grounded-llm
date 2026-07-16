# Data Model: fallbackValue opcional na família de generators

**Feature**: 003-optional-fallback | **Date**: 2026-07-16

Nenhuma entidade nova é introduzida. Esta feature altera a obrigatoriedade e as
regras de dois tipos já existentes (`core/types.ts`, feature 001, e
`GroundedExtractionConfig`, feature 002) e o significado de alguns dos campos de
resultado já definidos — sem mudar seu formato.

## GroundedCallConfig (ajuste — `core/types.ts`)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `fallbackValue` | `TFallback` | **Não** (era obrigatório) | Quando fornecido, não pode ser string vazia (rejeitado na construção, FR-002). Quando omitido, o componente entra no modo "sempre produz um resultado real" descrito abaixo. |

Todos os demais campos (`client`, `apiKey`, `model`, `temperature`,
`maxContextTokens`, `identity`, `rules`) permanecem inalterados.

## GroundedExtractionConfig (ajuste — `GroundedExtractor.ts`)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `fallbackValue` | objeto completo, mesmo formato de `fields` | **Não** (era obrigatório) | Mesma regra acima. Quando omitido, `strict` é ignorado (FR-009). |

`fields` e `strict` permanecem inalterados na forma; `strict` só passa a ter efeito
prático quando `fallbackValue` está configurado.

## GroundedCallResult (reaproveitado — sem mudança de forma)

Usado por `GroundedGenerator` e `GroundedEnricher`. Nenhum campo muda de nome ou
tipo; o que muda é o conjunto de valores possíveis e sua origem.

| Campo | Tipo | Regras específicas desta feature |
|---|---|---|
| `finalAnswer` | string | `GroundedGenerator` sem `fallbackValue`: sempre a resposta gerada pelo modelo (`output.final_answer`), mesmo quando `sufficient_context` é falso — nunca um valor fixo, nunca vazio (FR-003, FR-004). Com `fallbackValue`: inalterado (FR-007). `GroundedEnricher`: inalterado em ambos os casos (FR-008) |
| `usedFallback` | boolean | Sempre `false` quando `fallbackValue` não está configurado, para qualquer componente (FR-006) |
| `extractedFacts` | string[] | Continua refletindo os trechos realmente extraídos pelo modelo, com ou sem `fallbackValue` (FR-005) |
| `reasoning` | string | Continua refletindo a avaliação real de suficiência feita pelo modelo, com ou sem `fallbackValue` (FR-005) |

## GroundedExtractionResult (reaproveitado — sem mudança de forma)

| Campo | Tipo | Regras específicas desta feature |
|---|---|---|
| `data` | `ExtractionData<Fields>` (cada campo `T \| null`) | Sem `fallbackValue`: sempre os dados extraídos pelo modelo, com `null` nos campos ausentes — tanto no caso "nada extraível" quanto "extração parcial com `strict: true`" (FR-009). Mensagem vazia/em branco sem `fallbackValue`: objeto com todos os campos em `null`, sem chamar o modelo (FR-011). Com `fallbackValue`: inalterado (FR-010) |
| `usedFallback` | boolean | Sempre `false` quando `fallbackValue` não está configurado (FR-006) |
| `reasoning` | string | Sem mudança — continua vindo do modelo quando ele é chamado; texto fixo ("Message was empty or blank.") quando curto-circuitado por mensagem vazia, como já acontecia |

## Guards internos (não são API pública, mas fixam o comportamento)

- **`GroundedGenerator`**: `hasFallback = this.fallbackValue !== undefined`. Controla
  (a) se o contexto vazio/em branco curto-circuita sem chamar o modelo, (b) qual
  variante do system prompt é usada, e (c) se o resultado final é substituído por
  `fallbackValue` quando `!sufficient_context || extracted_facts.length === 0`.
- **`GroundedExtractor`**: `shouldFallback = hasFallback && (allNull || (someNull &&
  this.strict))`. Controla se `extract()` retorna `this.fallbackValue` ou os dados
  brutos extraídos (com `null` nos ausentes, via `buildEmptyData()` quando não há
  fallback e o método é chamado antes mesmo de haver um `data` do modelo — ex.:
  mensagem vazia).

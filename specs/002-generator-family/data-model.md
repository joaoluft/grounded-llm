# Data Model: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Feature**: 002-generator-family | **Date**: 2026-07-15

Entidades derivadas do spec (`Key Entities`), descritas de forma agnóstica a
implementação onde possível. Reaproveita `GroundedCallConfig`/`GroundedCallResult` de
`core/types.ts` (feature 001) sem alterá-los.

## GroundedGenerator (ajuste, sem novas entidades)

Nenhuma entidade nova. O schema estruturado interno (`extracted_facts`,
`sufficient_context`, `reasoning`, `final_answer`) ganha `.describe()` por campo
(FR-301); a forma dos dados e o comportamento observável (`GroundedCallConfig`,
`GroundedCallResult`) permanecem idênticos aos definidos na feature 001.

## EnrichmentRequest (Solicitação de Enriquecimento)

Representa uma chamada ao `GroundedEnricher`.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `baseContent` | string | Sim | Texto-base a enriquecer; vazio/em branco é uso inválido, rejeitado imediatamente com uma exceção, sem envolver `fallbackValue` (FR-110) |
| `context` | string | Sim | Contexto recuperado; vazio/em branco é insuficiente (não erro de uso) — resulta em `baseContent` inalterado (FR-106) |

## GroundedCallResult (reaproveitado do GroundedEnricher)

Mesmo tipo já definido em `core/types.ts` (feature 001) — sem alteração de forma.

| Campo | Tipo | Regras específicas do GroundedEnricher |
|---|---|---|
| `finalAnswer` | string | Texto enriquecido quando `usedFallback = false`; `baseContent` inalterado quando `usedFallback = true` por contexto insuficiente. `fallbackValue` nunca aparece aqui — `baseContent` inválido lança uma exceção em vez de retornar um resultado (ver FR-110) |
| `usedFallback` | boolean | `true` quando nenhum enriquecimento foi aplicado (contexto insuficiente) |
| `extractedFacts` | string[] | Trechos do `context` usados para enriquecer; vazio quando `usedFallback = true` |
| `reasoning` | string | Conecta os trechos extraídos ao enriquecimento (ou explica por que não houve enriquecimento) |

## FieldsDefinition (Definição de Campos de Extração)

Schema de campos fornecido pelo desenvolvedor no momento da construção do
`GroundedExtractor`, descrevendo o formato de dado alvo (ex.: `{ name: string, email:
string, intent: string }`). Cada campo é tratado internamente como opcional para
efeito de extração (ver research.md) — a obrigatoriedade declarada pelo desenvolvedor
descreve o *dado de domínio* esperado, não uma garantia de que o modelo sempre o
extrairá.

## GroundedExtractionConfig (Configuração do Componente — GroundedExtractor)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `client` | instância do client `openai` | Não | Mesma regra do `GroundedCallConfig` (FR-008 da feature 001) |
| `apiKey` | string | Não | Mesma regra do `GroundedCallConfig` |
| `model` | string | Não | Mesma regra do `GroundedCallConfig` |
| `fields` | `FieldsDefinition` | Sim | Define os campos a extrair; sem default |
| `fallbackValue` | objeto completo, mesmo formato de `fields` | Sim | Sem default implícito; construção falha se ausente (FR-205) |
| `strict` | boolean | Não | Default `false`. Controla se extração parcial é aceita (FR-211) |
| `temperature` | number | Não | Default `0` |
| `maxContextTokens` | number | Não | Mesma regra do `GroundedCallConfig` |

## ExtractionRequest (Solicitação de Extração)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `message` | string | Sim | Mensagem do usuário a processar; vazia/em branco é informação insuficiente para qualquer campo (aciona `fallbackValue`, Edge Case) |

## GroundedExtractionResult (Resultado de Extração)

Tipo próprio (não reaproveita `GroundedCallResult`, já que a saída é um objeto
estruturado, não uma string) — genérico sobre o formato de `fields`.

| Campo | Tipo | Regras |
|---|---|---|
| `data` | objeto (mesmo formato de `fields`, campos podem ser `null` se `strict = false` e parcialmente extraído) | Valores extraídos, ou `fallbackValue` quando `usedFallback = true` |
| `usedFallback` | boolean | `true` quando: nenhum campo extraível (FR-206), ou `strict = true` e extração incompleta (FR-211) |
| `reasoning` | string | Conecta o texto da mensagem aos valores extraídos (ou explica por que caiu em fallback) |

Invariante: se `usedFallback = false`, `data` MUST conter apenas valores derivados da
`message` fornecida (FR-203) — verificado por teste de comportamento, mesma abordagem
da feature 001 (sem checagem de consistência em tempo de execução).

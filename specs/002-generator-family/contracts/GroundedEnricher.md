# Contract: GroundedEnricher (Public API)

**Feature**: 002-generator-family | **Date**: 2026-07-15

## Construção

Mesma forma de `GroundedCallConfig` (ver `core/types.ts`, feature 001):
`fallbackValue` (obrigatório), `client`/`apiKey`/`model` (opcionais, mesma regra de
resolução do `GroundedGenerator`), `temperature` (default `0`), `maxContextTokens`.

## Operação principal: enriquecer texto

**Entrada** (`EnrichmentRequest`):

- `baseContent` (string, obrigatório) — vazio/em branco MUST ser rejeitado
  imediatamente como uso inválido, sem chamar o modelo.
- `context` (string, obrigatório) — vazio/em branco é tratado como insuficiente (não
  erro de uso).

**Saída em caso de sucesso ou não-enriquecimento** (`GroundedCallResult`, reaproveitado
da feature 001):

- `finalAnswer` (string)
- `usedFallback` (boolean)
- `extractedFacts` (array de string)
- `reasoning` (string)

**Saída em caso de erro operacional**: mesmas três categorias já definidas para o
`GroundedGenerator` (`ModelUnavailableError`, `ContextTooLargeError`,
`InvalidModelOutputError`), reaproveitadas de `core/errors.ts` sem alteração.

## Regras de comportamento observável (derivadas do spec)

1. Se `baseContent` estiver vazio/em branco → erro de uso lançado imediatamente
   (não um `GroundedCallResult` com fallback).
2. Se `context` estiver vazio/em branco, ou nenhum trecho relevante for extraído →
   `usedFallback = true`, `finalAnswer = baseContent` (inalterado), `extractedFacts`
   vazio.
3. Se `usedFallback = false` → `finalAnswer` MUST ser rastreável a `baseContent`
   combinado com um ou mais itens de `extractedFacts`, sem informação externa a essas
   duas fontes (FR-104).
4. O `fallbackValue` configurado NÃO é retornado em nenhum fluxo de sucesso deste
   componente — nem quando `baseContent` é inválido (regra 1, que lança uma exceção
   em vez de retornar um resultado), nem por insuficiência de contexto (regra 2, que
   retorna `baseContent` inalterado). Ele é exigido na construção apenas por
   consistência de API com os demais componentes da família (ver spec.md
   Assumptions).
5. Chamadas repetidas com o mesmo `baseContent` + `context` MUST produzir resultados
   consistentes (determinístico por padrão).
6. Sem redação/mascaramento de dados sensíveis, sem retry automático, stateless entre
   chamadas — mesmas regras já estabelecidas para o `GroundedGenerator`.

## Fora de escopo deste contrato

- Streaming, verificação de consistência pós-geração, suporte a providers além da
  OpenAI — mesmas exclusões da feature 001.
- Cálculo de confiança via logprob (exclusivo do futuro `GroundedDecider`).

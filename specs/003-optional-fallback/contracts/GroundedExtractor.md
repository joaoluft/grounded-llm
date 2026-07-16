# Contract: GroundedExtractor (Public API) — ajuste de fallbackValue opcional

**Feature**: 003-optional-fallback | **Date**: 2026-07-16

Este contrato documenta apenas o que muda em relação ao contrato já estabelecido na
feature 002. A assinatura pública (`ExtractionRequest`, `GroundedExtractionResult`, os
três erros operacionais) não muda de forma.

## Construção

- `fallbackValue` (objeto completo, mesmo formato de `fields`) — **deixa de ser
  obrigatório**. Quando fornecido, ainda MUST ser rejeitado se representar um valor
  vazio inválido (mesma regra de hoje, herdada de `GroundedCallConfig`). Quando
  omitido, `strict` é ignorado (ver abaixo).
- `fields` e `strict` permanecem inalterados na forma.

## Operação principal: extrair dados

**Entrada** (`ExtractionRequest`): inalterada — `message`.

**Saída** (`GroundedExtractionResult`): forma inalterada — `data`, `usedFallback`,
`reasoning`.

## Regras de comportamento observável (derivadas do spec)

### Com `fallbackValue` configurado (inalterado)

1. `message` vazia/em branco, ou nenhum campo extraível → `usedFallback = true`,
   `data = fallbackValue` (objeto completo) (FR-010).
2. Todos os campos extraíveis → `usedFallback = false`, `data` contém todos os
   valores.
3. Extração parcial: `strict = false` (default) → `usedFallback = false`, `data`
   contém os campos extraídos e `null` nos demais. `strict = true` → `usedFallback =
   true`, `data = fallbackValue` (objeto completo) (FR-010).

### Sem `fallbackValue` configurado (novo)

4. `message` vazia/em branco → **sem chamar o modelo**, `data` é um objeto com todos
   os campos em `null`, `usedFallback = false` (FR-011).
5. Nenhum campo extraível → `data` é um objeto com todos os campos em `null`,
   `usedFallback = false`, **nunca lança erro** (FR-009).
6. Extração parcial, com ou sem `strict: true` → `strict` é **ignorado**; `data`
   contém os campos extraídos e `null` nos demais, `usedFallback = false` (FR-009).
7. Todos os campos extraíveis → mesmo comportamento do caso "com fallback":
   `usedFallback = false`, `data` contém todos os valores.

## Erros operacionais

Inalterado — mesmas três categorias já definidas na feature 001
(`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`), com ou
sem `fallbackValue` configurado.

## Compatibilidade retroativa

Todo o comportamento "Com `fallbackValue` configurado" acima é idêntico ao contrato
anterior a esta feature — nenhum consumidor existente que já configura
`fallbackValue` observa qualquer diferença, incluindo o efeito de `strict` (FR-012,
SC-001).

## GroundedEnricher — sem contrato próprio nesta feature

`GroundedEnricher` não tem nenhuma regra de comportamento observável alterada por
esta feature (FR-008) — apenas herda a relaxação de tipo de `GroundedCallConfig`,
podendo ser construído sem `fallbackValue`. O contrato já definido na feature 002
(`specs/002-generator-family/contracts/GroundedEnricher.md`) permanece válido sem
alteração.

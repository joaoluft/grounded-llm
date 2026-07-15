# Quickstart: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Feature**: 002-generator-family | **Date**: 2026-07-15

Guia de validação end-to-end. Não contém código de implementação — apenas os passos e
cenários a rodar contra a implementação feita em `/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+, dependências já instaladas (`zod`, `openai`).
- Mock de `openai.chat.completions.create`/`.parse()` para testes locais (nenhuma
  chamada real à API).

## Setup

```bash
npm install
npm run build
npm test
```

## Cenários de validação

### Cenário 1 — GroundedGenerator sem regressão (US3)

1. Rodar a suíte de testes já existente da feature 001
   (`tests/unit/generators/GroundedGenerator.test.ts`,
   `tests/contract/generators/GroundedGenerator.schema.test.ts`, evaluations de
   SC-001/SC-002) sem nenhuma alteração de expectativa.
2. **Esperado**: 100% dos testes já existentes continuam passando, exatamente como
   antes do ajuste de descrições de campo.

### Cenário 2 — GroundedEnricher enriquece com contexto suficiente (US1)

1. Construir `GroundedEnricher` com `fallbackValue` configurado.
2. Chamar com um `baseContent` e um `context` que contém informação adicional
   relevante.
3. **Esperado**: `usedFallback = false`; `extractedFacts` não vazio; `finalAnswer`
   incorpora `baseContent` + informação de `extractedFacts`, sem dados externos.

### Cenário 3 — GroundedEnricher preserva o texto-base quando o contexto é insuficiente (US1)

1. Chamar com um `context` sem informação relevante para adicionar (ou vazio/em
   branco).
2. **Esperado**: `usedFallback = true`; `finalAnswer === baseContent` (inalterado),
   não o `fallbackValue`.
3. Repetir com `baseContent` vazio/em branco.
   **Esperado**: erro de uso inválido lançado imediatamente, sem chamar o modelo.

### Cenário 4 — GroundedExtractor extrai com sucesso total e parcial (US2)

1. Construir `GroundedExtractor` com `fields`, `fallbackValue` (objeto completo), e
   `strict` omitido (default `false`).
2. Chamar com uma `message` que preenche todos os campos.
   **Esperado**: `usedFallback = false`; `data` completo, rastreável à mensagem.
3. Chamar com uma `message` que preenche apenas parte dos campos.
   **Esperado**: `usedFallback = false`; `data` com os campos extraídos e `null` nos
   ausentes (extração parcial aceita por default).
4. Repetir o cenário 3 com `strict: true` na construção.
   **Esperado**: `usedFallback = true`; `data === fallbackValue` (objeto completo,
   nenhum resultado parcial).

### Cenário 5 — GroundedExtractor aciona fallback quando nada é extraível (US2)

1. Chamar com uma `message` vazia/em branco, ou sem nenhuma informação relacionada a
   `fields`.
2. **Esperado**: `usedFallback = true`; `data === fallbackValue` (objeto completo).

### Cenário 6 — Erros operacionais reaproveitados (FR-109/209)

1. Simular indisponibilidade/timeout no client mockado para `GroundedEnricher` e
   `GroundedExtractor`.
   **Esperado**: `ModelUnavailableError` distinto de `usedFallback = true`.
2. Fornecer `context`/`message` propositalmente maior que `maxContextTokens`.
   **Esperado**: `ContextTooLargeError`, sem chamar o modelo.

### Cenário 7 — Personalização via identity/rules em todos os componentes (US4)

1. Construir cada um dos três componentes (`GroundedGenerator`, `GroundedEnricher`,
   `GroundedExtractor`) com `identity` e `rules` configurados.
2. Fazer uma chamada em cada um.
3. **Esperado**: a mensagem `system` enviada ao modelo contém, nesta ordem: as
   instruções internas de ancoragem do componente, depois `identity`, depois
   `rules`.
4. Repetir sem configurar `identity`/`rules`.
   **Esperado**: nenhuma seção adicional aparece na mensagem `system` — comportamento
   idêntico ao anterior à introdução desta capacidade.

## Critério de aceite do quickstart

Os 7 cenários acima devem passar como testes automatizados (`vitest`) antes de
considerar a feature pronta para revisão, cobrindo SC-101 a SC-106, SC-401, SC-402, e
confirmando ausência de regressão no `GroundedGenerator` (SC-105) e nos demais
componentes (SC-402).

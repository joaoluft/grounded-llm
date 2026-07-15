# Quickstart: GroundedGenerator

**Feature**: 001-grounded-generator | **Date**: 2026-07-15

Guia de validação end-to-end para confirmar que o `GroundedGenerator` atende ao contrato
descrito em `contracts/GroundedGenerator.md` e ao spec (`spec.md`). Não contém código de
implementação — apenas os passos e cenários a rodar contra a implementação já feita em
`/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+ instalado.
- Dependências da lib instaladas (`zod`, `openai`, `tiktoken` ou equivalente).
- Para validação local: mock de `openai.chat.completions.create` retornando respostas
  estruturadas determinísticas (ver `tests/unit/generators/GroundedGenerator.test.ts`); para
  validação de integração real, uma `OPENAI_API_KEY` válida (ou passada explicitamente na
  configuração).

## Setup

```bash
npm install
npm run build
npm run test -- generators/GroundedGenerator
```

## Cenários de validação (mapeados às User Stories do spec)

### Cenário 1 — Resposta ancorada com contexto suficiente (US1)

1. Construir o `GroundedGenerator` com `fallbackValue` configurado e `openai.chat.completions.create`
   mockado para retornar uma saída estruturada determinística.
2. Chamar a operação de geração com um `context` que contém a resposta e uma `question`
   correspondente.
3. **Esperado**: `usedFallback = false`; `extractedFacts` não vazio; `finalAnswer` só contém
   informação presente em `extractedFacts`; `reasoning` explica a ligação entre os fatos e a
   resposta.

### Cenário 2 — Fallback com contexto insuficiente (US2)

1. Chamar a geração com um `context` que não contém informação relacionada à `question`.
2. **Esperado**: `usedFallback = true`; `finalAnswer` igual ao `fallbackValue` configurado;
   `extractedFacts` vazio ou irrelevante; nenhuma informação inventada.
3. Repetir com `context` vazio/em branco — mesmo resultado esperado.
4. Repetir com `context` contendo informação contraditória sobre o mesmo fato — mesmo resultado
   esperado (fallback acionado).

### Cenário 3 — Integração sem reescrever retrieval, standalone de qualquer orquestração (US3)

1. Instanciar o `GroundedGenerator` dentro de um pipeline de teste que já produz `context` via
   sua própria lógica de retrieval (ex.: um node de função dentro de um grafo LangGraph
   simulado, ou uma chain manual), sem adaptar tipos de terceiros.
2. Substituir a chamada de geração atual pelo `GroundedGenerator`, mantendo a lógica de
   retrieval (montagem do `context`) inalterada.
3. **Esperado**: o componente aceita o mesmo `context` já produzido pela lógica existente, sem
   exigir alterações nela e sem exigir que o pipeline implemente qualquer interface do
   `GroundedGenerator` além de fornecer `context` e `question`.

### Cenário 4 — Erros operacionais (FR-010, FR-011)

1. Simular indisponibilidade/timeout em `openai.chat.completions.create` (mock).
   **Esperado**: erro operacional distinto de `usedFallback = true`, identificável como falha
   técnica.
2. Fornecer um `context` propositalmente maior que `maxContextTokens` configurado.
   **Esperado**: erro operacional distinto (`ContextTooLargeError` ou equivalente), sem
   truncamento silencioso e sem chamar o modelo.

## Critério de aceite do quickstart

Os 4 cenários acima devem passar como testes automatizados (`vitest`) antes de considerar a
feature pronta para revisão, cobrindo os Success Criteria SC-001 a SC-004 do spec.

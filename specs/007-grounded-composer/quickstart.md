# Quickstart: GroundedComposer

**Feature**: 007-grounded-composer | **Date**: 2026-07-17

Guia de validação end-to-end. Não contém código de implementação — apenas os passos e
cenários a rodar contra a implementação feita em `/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+, dependências já instaladas (`zod`, `openai`).
- Mock do client de modelo (mesma estratégia de mock usada por
  `tests/unit/generators/grounded-enricher.test.ts`) — nenhuma chamada real à API.

## Setup

```bash
npm install
npm run build
npm test
```

## Cenários de validação

### Cenário 1 — Compor a partir apenas de `instructions` (US1)

1. Construir `GroundedComposer` sem `fallbackValue` (não aplicável a este componente).
2. Chamar com `instructions` descrevendo uma pergunta específica (ex.: "pergunte o
   protocolo de atendimento, apresentando as opções: X, Y, Novo Atendimento") e sem
   `context`.
3. **Esperado**: `usedFallback = false`; `extractedFacts` não vazio (trechos de
   `instructions`); `finalAnswer` faz exatamente a pergunta descrita, sem inventar
   opções fora das fornecidas.

### Cenário 2 — Nunca se abster (US1)

1. Repetir o Cenário 1 múltiplas vezes com `instructions` variadas (incluindo casos
   ambíguos ou pouco específicos).
2. **Esperado**: em 100% das chamadas, `finalAnswer` não é vazia e `usedFallback` é
   sempre `false` — nunca há uma resposta genérica de recusa (valida SC-001).

### Cenário 3 — `context` influencia a mensagem quando relevante (US2)

1. Chamar com as mesmas `instructions` do Cenário 1, agora com um `context` que
   menciona algo em conflito com uma regra de negócio referenciada nas `instructions`
   (ex.: cliente pediu marca não atendida).
2. **Esperado**: `extractedFacts` inclui trechos tanto de `instructions` quanto do
   `context` relevante; `reasoning` conecta o trecho do `context` à forma como
   `finalAnswer` aborda o conflito antes/junto da pergunta.

### Cenário 4 — `context` ausente ou irrelevante não bloqueia nem contamina a saída (US2)

1. Repetir o Cenário 1 com `context` vazio/em branco/ausente.
   **Esperado**: `finalAnswer` idêntica em espírito ao Cenário 1 (baseada só em
   `instructions`), sem erro.
2. Chamar com um `context` presente mas irrelevante para a pergunta atual.
   **Esperado**: `extractedFacts` contém apenas trechos de `instructions` (nenhum de
   `context`); `finalAnswer` segue as `instructions` normalmente.

### Cenário 5 — Uso inválido: `instructions` vazia (edge case)

1. Chamar com `instructions` vazia ou em branco.
   **Esperado**: erro de uso inválido lançado imediatamente, antes de qualquer
   chamada ao modelo (mesmo padrão de mensagem de `GroundedGenerator`/`GroundedEnricher`
   para seus campos obrigatórios).

### Cenário 6 — Rastreabilidade e composição de identity/rules/tone (US3)

1. Construir `GroundedComposer` com `identity`/`rules`/`tone` configurados.
2. Chamar com `instructions` + `context` válidos.
   **Esperado**: o prompt enviado ao modelo inclui as seções adicionais na mesma
   ordem já validada para `GroundedGenerator`/`GroundedEnricher` (instruções internas
   de ancoragem → identity → rules → tone); `extractedFacts` e `reasoning` continuam
   presentes e rastreáveis a `instructions`/`context`, mesmo com essas seções
   adicionais no prompt.

### Cenário 7 — Sem regressão nos componentes existentes (FR-714)

1. Rodar a suíte de testes já existente de `GroundedGenerator`, `GroundedEnricher`,
   `GroundedExtractor`.
2. **Esperado**: 100% dos testes já existentes continuam passando, sem nenhuma
   alteração de expectativa (valida SC-004).

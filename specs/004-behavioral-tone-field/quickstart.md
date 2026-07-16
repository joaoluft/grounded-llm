# Quickstart: Campo opcional de comportamento/tom para a família de generators

**Feature**: 004-behavioral-tone-field | **Date**: 2026-07-16

Guia de validação end-to-end. Não contém código de implementação — apenas os passos e
cenários a rodar contra a implementação feita em `/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+, dependências já instaladas (`zod`, `openai`).
- Mock de `openai.chat.completions.create`/`.parse()` para testes locais (nenhuma
  chamada real à API), seguindo o mesmo padrão das features anteriores.

## Setup

```bash
npm install
npm run build
npm test
```

## Cenários de validação

### Cenário 1 — `tone` aparece no prompt, depois das instruções internas (US1)

1. Construir `GroundedGenerator` com `tone: "seja empático e gentil"`.
2. Fazer uma chamada qualquer.
3. **Esperado**: a mensagem de sistema enviada ao mock do client `openai` contém o
   texto de `tone`, posicionado depois das instruções internas de ancoragem do
   `GroundedGenerator`.

### Cenário 2 — `tone` omitido não altera o prompt (regressão)

1. Construir `GroundedGenerator` sem `tone` (como em qualquer teste já existente).
2. Fazer uma chamada qualquer.
3. **Esperado**: a mensagem de sistema é idêntica à de antes desta feature — nenhuma
   seção adicional de tom aparece.

### Cenário 3 — Ordem de composição com identity + rules + tone (US1)

1. Construir `GroundedGenerator` com `identity`, `rules`, e `tone` configurados
   simultaneamente.
2. Fazer uma chamada qualquer.
3. **Esperado**: a mensagem de sistema contém as três seções, nesta ordem relativa:
   instruções internas → `identity` → `rules` → `tone`.

### Cenário 4 — Consistência entre os três componentes (US2)

1. Construir `GroundedGenerator`, `GroundedEnricher`, e `GroundedExtractor`, cada um
   com o mesmo texto de `tone`.
2. Fazer uma chamada em cada um.
3. **Esperado**: em todos os três, a mensagem de sistema contém o texto de `tone`,
   posicionado depois das instruções internas daquele componente especificamente.

### Cenário 5 — `tone` vazio/em branco é tratado como não configurado (edge case)

1. Construir qualquer um dos três componentes com `tone: "   "` (só espaços).
2. Fazer uma chamada qualquer.
3. **Esperado**: nenhuma seção de tom aparece na mensagem de sistema — mesmo
   comportamento de `tone` omitido.

## Referências

- Regras completas de comportamento observável: `contracts/tone-composition.md`.
- Forma dos tipos afetados: `data-model.md`.
- Racional das decisões (reaproveitar `buildSystemPrompt`, ordem de composição):
  `research.md`.

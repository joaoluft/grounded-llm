# Data Model: Campo opcional de comportamento/tom para a família de generators

**Feature**: 004-behavioral-tone-field | **Date**: 2026-07-16

Nenhuma entidade nova. Esta feature adiciona um campo a dois tipos já existentes
(`GroundedCallConfig`, `GroundedExtractionConfig`) e estende o comportamento de um
método já existente (`GroundedCall.buildSystemPrompt`) — sem mudar o formato de
nenhum resultado (`GroundedCallResult`, `GroundedExtractionResult`).

## GroundedCallConfig (ajuste — `core/types.ts`)

Usado por `GroundedGenerator` e `GroundedEnricher`.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `tone` | string | Não | Texto livre descrevendo o tom/personalidade desejado (ex.: "seja empático e gentil"). Sem valor default. String vazia/em branco é tratada como não configurado — nenhuma seção adicional é incluída no prompt. |

Todos os demais campos (`client`, `apiKey`, `model`, `fallbackValue`, `temperature`,
`maxContextTokens`, `identity`, `rules`) permanecem inalterados.

## GroundedExtractionConfig (ajuste — `GroundedExtractor.ts`)

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `tone` | string | Não | Mesma regra acima — mesmo campo, mesmo comportamento, espelhando `identity`/`rules` já existentes nesta interface. |

## Comportamento de `buildSystemPrompt` (não é tipo público, mas fixa o contrato)

`protected buildSystemPrompt(basePrompt: string): string`, em `core/GroundedCall.ts`,
usado por todos os três componentes:

1. Começa com `basePrompt` (as instruções internas de ancoragem/anti-alucinação do
   componente chamador).
2. Se `this.identity` estiver presente (não vazio), anexa a seção de papel/objetivo.
3. Se `this.rules` estiver presente (não vazio), anexa a seção de regras adicionais.
4. Se `this.tone` estiver presente (não vazio), anexa a seção de tom/comportamento —
   **sempre por último**, depois de `identity` e `rules`.
5. Nenhuma dessas seções jamais precede ou substitui `basePrompt` — elas são sempre
   texto adicional ao final.

## GroundedCallResult / GroundedExtractionResult

Sem mudança de forma ou de significado de nenhum campo — `tone` não afeta
`finalAnswer`/`data`, `usedFallback`, `extractedFacts`, ou `reasoning` além do efeito
estilístico que o próprio modelo aplica à resposta gerada.

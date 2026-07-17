# Phase 1 Data Model: GroundedComposer

## `ComposerRequest` (entrada por chamada)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `instructions` | `string` | Sim | Texto que determina o conteúdo obrigatório da mensagem a ser composta (ex.: qual pergunta fazer, opções a apresentar, estilo de abertura). Vazio/em branco → erro síncrono, sem chamada ao modelo (FR-703). |
| `context` | `string \| undefined` | Não | Dados de conversa de apoio (ex.: resumo + dados já coletados). Ausente/vazio/em branco → tratado como "sem dados de conversa", sem erro (FR-704). |

Corresponde à entidade "Instruções da chamada" + "Dados de conversa" do spec.md.

## `groundedCompositionSchema` (saída estruturada do modelo)

| Campo | Tipo | Regras |
|---|---|---|
| `applied_rules` | `string[]` | Trechos literais de `instructions` que sustentam a mensagem. Nunca vazio em execução bem-sucedida (FR-706). |
| `context_used` | `boolean` | Se algum trecho de `context` influenciou a mensagem (conflito, progresso, referência a dado já mencionado) (FR-707). Sempre `false` quando `context` não foi fornecido. |
| `context_excerpts` | `string[]` | Trechos literais de `context` que sustentam `context_used`. Vazio quando `context_used = false` (FR-708). |
| `reasoning` | `string` | Raciocínio conectando `applied_rules` (e `context_excerpts`, quando houver) à `final_message` (FR-709). |
| `final_message` | `string` | Mensagem final composta. Sempre preenchida — não existe caminho onde fica vazia (FR-705). |

Corresponde à entidade "Resultado da composição" do spec.md.

## `GroundedCallResult` (superfície pública, reaproveitada — ver research.md Decisão 3)

| Campo | Origem no schema estruturado |
|---|---|
| `finalAnswer` | `final_message` |
| `usedFallback` | Sempre `false` (constante — nunca lido do modelo) |
| `extractedFacts` | `applied_rules` concatenado com `context_excerpts` (nesta ordem) |
| `reasoning` | `reasoning` |

## Validações (antes de qualquer chamada ao modelo)

- `instructions` vazio/em branco → `Error('GroundedComposer: \`instructions\` must be a non-empty string.')`, mesmo padrão de mensagem usado por `GroundedGenerator`/`GroundedEnricher` para seus campos obrigatórios.
- `context` vazio/em branco/ausente → normalizado internamente para "sem dados de conversa" (não é erro; ver FR-704).
- `assertContextWithinLimit` (herdado de `GroundedCall`, inalterado) aplicado sobre `systemPrompt + userPrompt` antes da chamada ao modelo, mesmo padrão dos demais componentes.

## Sem transições de estado

`GroundedComposer` é stateless por chamada (mesmo modelo dos demais generators) — não há entidade persistida nem máquina de estados.

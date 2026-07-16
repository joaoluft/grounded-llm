# Implementation Plan: Campo opcional de comportamento/tom para a família de generators

**Branch**: `004-behavioral-tone-field` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-behavioral-tone-field/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Adiciona um terceiro parâmetro opcional de personalização, `tone` (string, sem
default), aos três componentes da família (`GroundedGenerator`, `GroundedEnricher`,
`GroundedExtractor`), reaproveitando integralmente o mecanismo de composição de
prompt (`buildSystemPrompt`) já introduzido para `identity`/`rules` na feature
002-generator-family. Quando configurado, `tone` é anexado como uma terceira seção do
system prompt, sempre depois de `identity` e `rules` (ordem `identity → rules →
tone`, confirmada com o usuário), nunca sobrescrevendo as instruções internas de
ancoragem/anti-alucinação de cada componente. Quando omitido ou vazio/em branco,
nenhuma seção adicional é incluída — comportamento idêntico ao atual.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+ (mesma base das features
001/002/003)

**Primary Dependencies**: `zod`, `openai` — nenhuma dependência nova introduzida

**Storage**: N/A (componentes stateless, sem persistência própria)

**Testing**: `vitest`, mockando `openai.chat.completions.create`/`.parse()` (nenhuma
chamada real à API OpenAI em testes), seguindo o mesmo padrão das features anteriores

**Target Platform**: Node.js 20+ (server-side); mesma distribuição da lib (dual
ESM+CJS via `tsup`)

**Project Type**: library (extensão aditiva dentro da lib `grounded-llm` existente)

**Performance Goals**: Sem meta própria — `tone` é apenas texto concatenado ao system
prompt já existente, sem chamada adicional ao modelo nem processamento extra

**Constraints**: Nenhum novo default; `tone` é puramente aditivo e opcional; ordem de
composição fixa (`identity → rules → tone`) quando múltiplos campos estão presentes;
string vazia/em branco tratada como "não configurado", mesma regra já aplicada a
`identity`/`rules`

**Scale/Scope**: Ajustes pontuais em `core/types.ts`, `core/GroundedCall.ts`
(`buildSystemPrompt`), e `generators/GroundedExtractor.ts` (que declara seu próprio
config em vez de estender `GroundedCallConfig` diretamente); nenhuma mudança de
código em `GroundedGenerator.ts`/`GroundedEnricher.ts` além de já herdarem o campo via
`GroundedCallConfig` e já chamarem `buildSystemPrompt` — não introduzem lógica nova

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Mesma base das features anteriores: `.specify/memory/constitution.md` ainda está com
o template não preenchido; os princípios abaixo seguem o mesmo conjunto já usado nos
plans anteriores.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | Nenhum módulo novo é criado; a mudança vive inteiramente em `core/GroundedCall.ts`/`core/types.ts`, reaproveitados pelos três componentes já existentes | PASS |
| 2. Nunca gerar sem contenção | `tone` é texto livre, mas nunca é usado para determinar `sufficient_context`/extração/fallback — afeta só o estilo da resposta já validada por schema; nenhuma nova via de saída sem contenção é aberta | PASS |
| 3. Fallback obrigatório (já relaxado pela feature 003) | Não afetado — `tone` é ortogonal a `fallbackValue` | PASS (N/A) |
| 4. Extração antes de geração | Não afetado — `tone` só é lido na montagem do system prompt, depois que a lógica de extração/suficiência de cada componente já está definida | PASS |
| 5. Confiança é dado objetivo | Fora de escopo, sem mudança | PASS (N/A) |
| 6. Temperature zero por padrão | Não afetado | PASS |
| 7. TDD estrito | Testes de composição de prompt (ordem `identity → rules → tone`, string vazia = omitido) escritos antes da implementação, cobrindo os três componentes | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | `tone` não altera nenhum campo de `GroundedCallResult`/`GroundedExtractionResult` — apenas o texto do system prompt enviado ao modelo, que já não é exposto como parte da observabilidade pública (mesmo tratamento de `identity`/`rules`) | PASS |
| 9. Provider único no MVP | Sem mudança | PASS |

Nenhuma violação identificada. Seção "Complexity Tracking" não se aplica.

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/` confirmam que `tone`
é apenas mais um campo de texto livre composto por `buildSystemPrompt`, seguindo
exatamente o padrão já estabelecido por `identity`/`rules` — nenhuma entidade nova,
nenhuma mudança de schema de saída, nenhuma chamada adicional ao modelo. Gate PASS
mantido.

## Project Structure

### Documentation (this feature)

```text
specs/004-behavioral-tone-field/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts                    # + tone?: string em GroundedCallConfig
│   └── GroundedCall.ts             # + this.tone; buildSystemPrompt() passa a compor identity → rules → tone
└── generators/
    ├── GroundedGenerator.ts        # nenhuma mudança de código — já chama buildSystemPrompt(SYSTEM_PROMPT variant)
    ├── GroundedEnricher.ts         # nenhuma mudança de código — já chama buildSystemPrompt(SYSTEM_PROMPT)
    └── GroundedExtractor.ts        # + tone?: string em GroundedExtractionConfig (config próprio, não herda de GroundedCallConfig)

tests/
├── unit/
│   ├── core/
│   │   └── GroundedCall.test.ts        # + testes de composição com tone (isolado e combinado com identity/rules, ordem, string vazia)
│   └── generators/
│       ├── GroundedGenerator.test.ts   # + teste confirmando tone chega ao system message
│       ├── GroundedEnricher.test.ts    # + teste confirmando tone chega ao system message
│       └── GroundedExtractor.test.ts   # + teste confirmando tone chega ao system message
```

**Structure Decision**: Mesma estrutura de projeto único das features anteriores.
Nenhum diretório novo é criado. `GroundedGenerator.ts` e `GroundedEnricher.ts` não
precisam de nenhuma mudança de código — ambos já delegam a `this.buildSystemPrompt(...)`
para compor o prompt final, então a nova seção de `tone` chega a eles automaticamente
assim que `GroundedCall.buildSystemPrompt` for atualizado.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Não aplicável — nenhuma violação de complexidade a justificar.

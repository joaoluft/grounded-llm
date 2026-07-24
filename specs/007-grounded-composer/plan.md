# Implementation Plan: GroundedComposer

**Branch**: `007-grounded-composer` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-grounded-composer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Novo componente `GroundedComposer` em `src/generators/`, estendendo `GroundedCall` como
os demais membros da família. Diferente de `GroundedGenerator`/`GroundedEnricher`
(ancorados em `context`, com gate de suficiência e fallback), o `GroundedComposer`
ancora a mensagem final em `instructions` — texto obrigatório fornecido a cada chamada,
que já determina o conteúdo da mensagem — e trata `context` como apoio opcional (nunca
critério de suficiência). Não existe conceito de fallback/abstenção: a saída é sempre
uma mensagem composta a partir de `instructions`, com `context_used`/`context_excerpts`
substituindo `sufficient_context` no schema estruturado.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+ (mesma base das features 001/002/006)

**Primary Dependencies**: `zod`, `openai` — nenhuma dependência nova introduzida

**Storage**: N/A (componente stateless, sem persistência própria)

**Testing**: `vitest`, mockando o client de modelo (`OpenAiModelClient`/`ModelClient`),
seguindo o mesmo padrão de `GroundedGenerator`/`GroundedEnricher` (schema em
`tests/contract/`, comportamento/composição em `tests/unit/`)

**Target Platform**: Node.js 20+ (server-side); mesma distribuição dual ESM+CJS via
`tsup`

**Project Type**: library (novo módulo dentro da lib `grounded-llm`)

**Performance Goals**: Sem meta própria além da latência inerente a uma única chamada
ao modelo configurado (mesmo racional dos demais generators)

**Constraints**: Single-turn; sem streaming; determinístico por padrão (`temperature`
default 0); `instructions` obrigatório e não-vazio (erro síncrono, sem chamada ao
modelo); `context` opcional; sem `fallbackValue` aplicável a este componente (nunca há
caminho de abstenção); reutiliza `assertContextWithinLimit` e `buildSystemPrompt`
(identity/rules/tone) de `GroundedCall` sem alteração

**Scale/Scope**: Um novo módulo (`grounded-composer.ts` + `grounded-composer.schema.ts`)
dentro de `src/generators/`; não altera `GroundedGenerator`, `GroundedEnricher`,
`GroundedExtractor`, nem `core/grounded-call.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` permanece com o template não preenchido, como nas
features anteriores (001/002/006) — os princípios abaixo são os mesmos já estabelecidos
e reutilizados nos planos anteriores deste projeto.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | `GroundedComposer` nasce como módulo isolado e testável em `src/generators/`, reaproveitando `GroundedCall` | PASS |
| 2. Nunca gerar sem contenção | Structured output via `zodResponseFormat`, mesmo padrão dos demais — nunca texto livre fora de schema | PASS |
| 3. Fallback obrigatório | N/A por design desta feature: `GroundedComposer` nunca se abstém, logo não há `fallbackValue` a exigir (FR-705, ver research.md para justificativa de não-violação) | PASS (N/A) |
| 4. Extração antes de geração | `applied_rules` é extraído de `instructions` antes de compor a mensagem final (FR-706), mesmo padrão dos demais | PASS |
| 5. Confiança é dado objetivo | Fora de escopo — não há cálculo de confiança via logprob neste componente | PASS (N/A) |
| 6. Temperature zero por padrão | `temperature` default 0 (FR-710) | PASS |
| 7. TDD estrito | Testes de schema e comportamento escritos antes da implementação | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | Resultado sempre inclui `usedFallback=false`, trechos extraídos e raciocínio (FR-709) | PASS |
| 9. Provider único no MVP | Reutiliza `GroundedCall`/`ModelClient` — mesmo suporte OpenAI/LangChain já existente, nenhum provider novo | PASS |

Nenhuma violação identificada. Seção "Complexity Tracking" não se aplica.

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/grounded-composer.md`
confirmam que `GroundedComposer` reutiliza `GroundedCallResult` sem alteração de forma
(princípio 8), e que a ausência de `fallbackValue` é uma omissão deliberada e documentada
(princípio 3, N/A) — não uma violação silenciosa. Gate PASS mantido.

## Project Structure

### Documentation (this feature)

```text
specs/007-grounded-composer/
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
│   └── grounded-call.ts               # Inalterado — reutilizado como base
└── generators/
    ├── grounded-composer.ts           # Novo — classe GroundedComposer
    └── grounded-composer.schema.ts    # Novo — schema estruturado (applied_rules,
                                        # context_used, context_excerpts, reasoning,
                                        # final_message)

tests/
├── unit/generators/
│   └── grounded-composer.test.ts      # Novo — comportamento (instructions obrigatório,
                                        # context opcional, nunca abstém, composição
                                        # identity/rules/tone via GroundedCall)
└── contract/generators/
    └── grounded-composer.schema.test.ts  # Novo — validação do schema estruturado
```

**Structure Decision**: Mesma estrutura de projeto único das features anteriores. O
novo componente entra em `src/generators/`, ao lado de `grounded-generator.ts` e
`grounded-enricher.ts`. Nenhum diretório novo de alto nível é criado; `core/grounded-call.ts`
não é modificado (diferente da feature 002/US4, aqui a personalização identity/rules/tone
já existe pronta para reutilização).

## Complexity Tracking

*Nenhuma violação da Constitution Check — seção não aplicável.*

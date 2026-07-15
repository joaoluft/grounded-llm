# Implementation Plan: GroundedGenerator

**Branch**: `001-grounded-generator` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-grounded-generator/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Componente de biblioteca (`GroundedGenerator`) que gera a resposta final de um chatbot a
partir de contexto recuperado e uma pergunta do usuário, forçando extração literal de fatos
do contexto e uma decisão explícita de suficiência antes de gerar a resposta. Se o contexto
for insuficiente, retorna um fallback configurado em vez de arriscar alucinação. Implementado
como componente standalone sobre o client oficial `openai`, sem dependência de LangChain ou
qualquer framework de orquestração, para poder ser plugado como um node de função dentro de
qualquer pipeline (LangGraph, chain manual, ou chamada direta) sem exigir tipos de terceiros.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+

**Primary Dependencies**: `zod` (schema/validação e definição do schema de saída), `openai`
(client oficial, único meio de chamada ao modelo — sem LangChain nem outro framework de
orquestração como dependência)

**Storage**: N/A (componente stateless, sem persistência própria)

**Testing**: `vitest`, mockando `openai.chat.completions.create` (nenhuma chamada real à API
OpenAI em testes)

**Target Platform**: Node.js 20+ (server-side); consumido como dependência de lib por
aplicações backend, plugável como função dentro de qualquer pipeline de orquestração (ex.:
LangGraph) sem exigir que o chamador implemente interfaces de terceiros

**Project Type**: library (módulo dentro da lib `grounded-llm`)

**Performance Goals**: Não há meta de performance própria além da latência inerente à chamada
única ao modelo `openai` configurado; sem meta quantitativa adicional nesta feature (fora de
escopo — ver Assumptions do spec)

**Constraints**: Operação single-turn (sem histórico de conversa gerenciado pelo componente);
sem streaming; determinístico por padrão (`temperature` default 0); `fallbackValue`
obrigatório no construtor, sem default implícito; saída estruturada via `zodResponseFormat`
(conversão do schema Zod para JSON Schema com `strict: true`)

**Scale/Scope**: Dois módulos nesta feature — `core/GroundedCall.ts` (classe base abstrata,
reaproveitável futuramente pelo `GroundedDecider`) e `generators/GroundedGenerator.ts`
(implementação concreta); não inclui `deciders/`, `verification/` nem `confidence/`, que são
fases/specs separadas

## Divergência em relação ao planejamento anterior

Esta revisão substitui a decisão de integração via `BaseChatModel` do LangChain (registrada na
primeira versão deste plano e em `research.md`) por um client `openai` direto e standalone,
por instrução explícita do usuário nesta chamada de `/speckit-plan`. O spec (FR-008) foi
atualizado em consequência via `/speckit-analyze` + correção manual: o componente aceita
opcionalmente uma instância já configurada do client `openai` (injetada pelo desenvolvedor,
com retry/timeout/baseURL customizados), e cria uma internamente a partir de `apiKey`/`model`
quando nenhuma instância é fornecida. O objetivo de negócio de US3 — não reescrever a lógica de
retrieval e integrar com o fluxo já existente do desenvolvedor — é atendido por o componente ser
standalone e sem interfaces de terceiros, funcionando dentro de LangGraph, chain manual, ou
chamada direta.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` ainda está com o template não preenchido; os
princípios abaixo foram extraídos do `/speckit.constitution` já definido para o projeto em
`CLAUDE.md` e são tratados como a constituição vigente para esta avaliação.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | `core/GroundedCall.ts` (base abstrata) + `generators/GroundedGenerator.ts` (concreto) nascem como módulos isolados e testáveis, sem acoplamento a uma aplicação específica | PASS |
| 2. Nunca gerar sem contenção | Toda saída (`extracted_facts`, `sufficient_context`, `reasoning`, `final_answer`) via structured output (`zodResponseFormat`, `strict: true`), nunca texto livre não contido em schema | PASS |
| 3. Fallback obrigatório | `fallbackValue` exigido explicitamente no construtor (FR-005); sem fallback, o componente não pode ser instanciado | PASS |
| 4. Extração antes de geração | Fatos extraídos literalmente do contexto antes da resposta final; resposta deriva exclusivamente do extraído (FR-001, FR-003) | PASS |
| 5. Confiança é dado objetivo | Fora de escopo desta feature — `GroundedGenerator` não calcula nem expõe um score de confiança; isso é responsabilidade do `GroundedDecider` (feature separada) | PASS (N/A) |
| 6. Temperature zero por padrão | `temperature` default 0 no construtor (FR-009) | PASS |
| 7. TDD estrito | Testes de schema Zod e de comportamento mockando `openai.chat.completions.create`, escritos antes da implementação | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | Resultado retornado inclui uso de fallback, fatos extraídos e raciocínio em toda execução (FR-006) | PASS |
| 9. Provider único no MVP | Único client suportado é o `openai` oficial; nenhum outro provider é abstraído; ausência de dependência de LangChain reforça o isolamento a um único provider | PASS |

Nenhuma violação identificada. Seção "Complexity Tracking" não se aplica.

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/GroundedGenerator.md`
confirmam que nenhuma entidade ou operação introduzida no design contraria os princípios acima
— em particular, `GroundedCallResult`/erro operacional mantêm a separação exigida pelo
princípio 8 (observabilidade) entre falha técnica, fallback e sucesso, e
`GroundedCallConfig.fallbackValue` permanece obrigatório sem default (princípio 3). Gate PASS
mantido.

## Project Structure

### Documentation (this feature)

```text
specs/001-grounded-generator/
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
│   ├── GroundedCall.ts       # Classe base abstrata: client openai, config comum, fallback
│   └── types.ts              # GroundedCallConfig, GroundedCallResult (tipos compartilhados)
├── generators/
│   └── GroundedGenerator.ts  # Implementação concreta desta feature
└── index.ts                  # Exports públicos da lib

tests/
├── unit/
│   ├── core/
│   │   └── GroundedCall.test.ts
│   └── generators/
│       └── GroundedGenerator.test.ts
└── contract/
    └── generators/
        └── GroundedGenerator.schema.test.ts   # Testes do schema Zod de saída
```

**Structure Decision**: Projeto único (lib TypeScript), sem separação frontend/backend.
`core/GroundedCall.ts` e `core/types.ts` nascem nesta feature mas são desenhados para
reaproveitamento futuro pelo `GroundedDecider` (fase 2 do planejamento geral). Os módulos
`deciders/`, `verification/` e `confidence/` descritos no planejamento geral do projeto
(`CLAUDE.md`) pertencem a features futuras e não são criados aqui.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

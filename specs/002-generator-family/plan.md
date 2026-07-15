# Implementation Plan: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Branch**: `002-generator-family` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-generator-family/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Quatro mudanças na lib `grounded-llm`, todas reaproveitando a base já existente
(`core/GroundedCall.ts`, `core/types.ts`): (1) adicionar `.describe()` aos campos do
schema estruturado do `GroundedGenerator`, sem alterar comportamento; (2) novo
componente `GroundedEnricher`, que enriquece um texto-base com contexto recuperado,
retornando o texto-base inalterado (não um fallback string) quando o contexto é
insuficiente; (3) novo componente `GroundedExtractor`, que extrai um objeto estruturado
com campos definidos pelo desenvolvedor a partir da mensagem do usuário, com fallback
como objeto completo e um modo `strict` (default `false`) controlando se extração
parcial é aceita; (4) **(US4, adicionada retroativamente após US1-US3 já implementadas)**
suporte a `identity`/`rules` opcionais em todos os três componentes, permitindo ao
desenvolvedor customizar papel/objetivo e regras adicionais do modelo naquela chamada,
sempre anexados depois das instruções internas de ancoragem/anti-alucinação.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+ (mesma base da feature 001)

**Primary Dependencies**: `zod`, `openai` — nenhuma dependência nova introduzida

**Storage**: N/A (componentes stateless, sem persistência própria)

**Testing**: `vitest`, mockando `openai.chat.completions.create`/`.parse()` (nenhuma
chamada real à API OpenAI em testes), seguindo o mesmo padrão da feature 001

**Target Platform**: Node.js 20+ (server-side); mesma distribuição da lib (dual
ESM+CJS via `tsup`)

**Project Type**: library (módulos adicionais dentro da lib `grounded-llm`)

**Performance Goals**: Sem meta própria além da latência inerente à chamada única ao
modelo `openai` configurado (mesmo racional da feature 001)

**Constraints**: Single-turn; sem streaming; determinístico por padrão (`temperature`
default 0); `fallbackValue` obrigatório em todos os três componentes; sem retry
automático; `GroundedExtractor` introduz o parâmetro `strict` (booleano, default
`false`)

**Scale/Scope**: Um ajuste (`GroundedGenerator`/`schema.ts`) + dois novos módulos
(`GroundedEnricher.ts`, `GroundedExtractor.ts`) dentro de `src/generators/`; não inclui
`GroundedDecider` nem `verification/`, que permanecem fora de escopo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Mesma base da feature 001: `.specify/memory/constitution.md` ainda está com o template
não preenchido; os princípios abaixo foram extraídos do `/speckit.constitution` já
definido para o projeto em `CLAUDE.md`.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | `GroundedEnricher`/`GroundedExtractor` nascem como módulos isolados e testáveis em `src/generators/`, reaproveitando `GroundedCall` | PASS |
| 2. Nunca gerar sem contenção | Ambos os novos componentes usam structured output (`zodResponseFormat`, `strict: true`), nunca texto livre fora de schema | PASS |
| 3. Fallback obrigatório | `fallbackValue` exigido no construtor dos dois novos componentes (FR-105, FR-205); sem fallback, não instanciam | PASS |
| 4. Extração antes de geração | `GroundedEnricher` extrai trechos do contexto antes de enriquecer (FR-102); `GroundedExtractor` extrai valores diretamente da mensagem (não há um passo de "extração de trechos" separado, pois a extração *é* o próprio objetivo do componente — ver research.md) | PASS |
| 5. Confiança é dado objetivo | Fora de escopo — nenhum dos dois novos componentes calcula confiança via logprob; isso permanece exclusivo do futuro `GroundedDecider` (FR-210) | PASS (N/A) |
| 6. Temperature zero por padrão | `temperature` default 0 em ambos (FR-108, FR-208) | PASS |
| 7. TDD estrito | Testes de schema e de comportamento mockando o client `openai`, escritos antes da implementação | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | Resultado de ambos inclui uso de fallback, trechos/raciocínio, em toda execução (FR-107, FR-207) | PASS |
| 9. Provider único no MVP | Mesma base `GroundedCall` — único client suportado é o `openai` oficial | PASS |

Nenhuma violação identificada. Seção "Complexity Tracking" não se aplica.

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/GroundedEnricher.md` /
`contracts/GroundedExtractor.md` confirmam que nenhuma entidade ou operação
introduzida contraria os princípios acima — em particular, `GroundedExtractionConfig`
mantém `fallbackValue` obrigatório (princípio 3) mesmo com o novo parâmetro `strict`,
e a reutilização de `GroundedCallResult` para o `GroundedEnricher` (em vez de um tipo
próprio) reforça a consistência de observabilidade (princípio 8) entre os componentes
da lib. Gate PASS mantido.

**Re-check pós-US4 (retroativo)**: a adição de `identity`/`rules` (FR-401 a FR-404)
não viola nenhum princípio — em particular, o princípio 2 ("nunca gerar sem
contenção") permanece intacto porque `identity`/`rules` são texto livre *anexado*
como seção adicional do system prompt, sempre depois das instruções internas de
ancoragem, nunca substituindo-as ou sendo interpretado como uma nova fonte de
verdade para extração/suficiência. `buildSystemPrompt()` é o único ponto que decide
a ordem de composição, garantindo essa propriedade de forma centralizada. Gate PASS
mantido.

## Project Structure

### Documentation (this feature)

```text
specs/002-generator-family/
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
│   ├── GroundedCall.ts            # US4 (retroativo): + buildSystemPrompt(), + identity/rules fields
│   └── types.ts                   # US4 (retroativo): + identity?/rules? em GroundedCallConfig
└── generators/
    ├── schema.ts                  # Ajuste: .describe() nos campos (FR-301)
    ├── GroundedGenerator.ts       # + uso de buildSystemPrompt() (US4), além do schema ajustado
    ├── GroundedEnricher.ts        # Novo; + uso de buildSystemPrompt() (US4)
    ├── GroundedEnricher.schema.ts # Novo — schema estruturado do enriquecimento
    ├── GroundedExtractor.ts       # Novo; + identity/rules em GroundedExtractionConfig (US4)
    └── GroundedExtractor.schema.ts # Novo — construção do schema nullable a partir dos campos do dev

tests/
├── unit/
│   ├── core/
│   │   └── GroundedCall.test.ts   # US4 (retroativo): + testes de buildSystemPrompt
│   └── generators/
│       ├── GroundedEnricher.test.ts
│       └── GroundedExtractor.test.ts
└── contract/
    └── generators/
        ├── GroundedGenerator.schema.test.ts   # Já existe — deve continuar passando (FR-302)
        ├── GroundedEnricher.schema.test.ts    # Novo
        └── GroundedExtractor.schema.test.ts   # Novo
```

**Structure Decision**: Mesma estrutura de projeto único da feature 001. Os dois novos
componentes entram em `src/generators/`, ao lado do `GroundedGenerator` existente.
**Atualização (US4, retroativa)**: diferente do planejado inicialmente, `core/GroundedCall.ts`
e `core/types.ts` **foram alterados** nesta feature — adição do método
`buildSystemPrompt()` e dos campos opcionais `identity`/`rules`, para suportar a
personalização de comportamento pedida pelo usuário após a implementação inicial (US1-US3).
Essa mudança é aditiva e retrocompatível (todos os 61 testes anteriores continuam
passando inalterados). Nenhum diretório novo de alto nível é criado.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

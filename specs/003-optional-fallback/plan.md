# Implementation Plan: fallbackValue opcional na família de generators

**Branch**: `003-optional-fallback` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-optional-fallback/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Torna `fallbackValue` opcional em `GroundedGenerator`, `GroundedEnricher` e
`GroundedExtractor`, reaproveitando a base já existente (`core/GroundedCall.ts`,
`core/types.ts`) sem introduzir nenhum novo parâmetro de configuração. O
comportamento passa a ser determinado inteiramente pela presença ou ausência de
`fallbackValue`: quando ausente, o `GroundedGenerator` sempre deixa o modelo produzir
uma resposta real (mesmo com contexto insuficiente ou vazio, chamando o modelo em vez
de curto-circuitar) e o `GroundedExtractor` sempre retorna os dados brutos extraídos
pelo modelo (ignorando `strict`), em vez de substituir por um valor fixo. O
`GroundedEnricher` não muda de comportamento em nenhum dos dois casos — já retornava
`baseContent` inalterado, nunca `fallbackValue`. A mudança é estritamente aditiva e
retrocompatível: todo consumidor que já configura `fallbackValue` hoje observa o
mesmo comportamento de antes.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+ (mesma base das features 001/002)

**Primary Dependencies**: `zod`, `openai` — nenhuma dependência nova introduzida

**Storage**: N/A (componentes stateless, sem persistência própria)

**Testing**: `vitest`, mockando `openai.chat.completions.create`/`.parse()` (nenhuma
chamada real à API OpenAI em testes), seguindo o mesmo padrão das features 001/002

**Target Platform**: Node.js 20+ (server-side); mesma distribuição da lib (dual
ESM+CJS via `tsup`)

**Project Type**: library (ajuste de comportamento dentro da lib `grounded-llm`
existente)

**Performance Goals**: Sem meta própria além da latência inerente à chamada única ao
modelo `openai` configurado (mesmo racional das features anteriores) — nenhuma
chamada extra ao modelo é introduzida por esta mudança

**Constraints**: Single-turn; sem streaming; determinístico por padrão (`temperature`
default 0); nenhum novo parâmetro de configuração; comportamento determinado só pela
presença/ausência de `fallbackValue`; retrocompatibilidade total obrigatória (FR-012)

**Scale/Scope**: Ajustes pontuais em `core/GroundedCall.ts`, `core/types.ts`,
`generators/GroundedGenerator.ts`, `generators/GroundedExtractor.ts`; nenhuma
mudança de código em `generators/GroundedEnricher.ts` (mudança de tipo herdada, sem
lógica nova); não inclui `GroundedDecider` nem `verification/`, que permanecem fora
de escopo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Mesma base das features 001/002: `.specify/memory/constitution.md` ainda está com o
template não preenchido; os princípios abaixo foram extraídos do mesmo conjunto já
usado no plan.md da feature 002.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | Nenhum módulo novo é criado; os três componentes continuam isolados e testáveis em `src/generators/`, reaproveitando `GroundedCall` | PASS |
| 2. Nunca gerar sem contenção | O `GroundedGenerator` continua usando structured output (`zodResponseFormat`) mesmo sem `fallbackValue` — a resposta livre do modelo ainda é extraída de um campo `final_answer` validado por schema, nunca texto solto fora de contenção | PASS |
| 3. Fallback obrigatório | Este princípio é o que a feature relaxa deliberadamente, por pedido explícito do usuário: `fallbackValue` deixa de ser obrigatório. A salvaguarda equivalente passa a ser comportamental — sem fallback, o componente é obrigado a sempre produzir um resultado real e nunca lançar erro por ausência de fallback (FR-001, FR-003, FR-004, FR-009, FR-011) | PASS (princípio relaxado por decisão de produto documentada no spec, não violado silenciosamente) |
| 4. Extração antes de geração | Inalterado — o passo de extração de trechos (`extracted_facts`) continua acontecendo antes da decisão de suficiência e da resposta final, com ou sem `fallbackValue` configurado (FR-005) | PASS |
| 5. Confiança é dado objetivo | Fora de escopo, sem mudança | PASS (N/A) |
| 6. Temperature zero por padrão | Inalterado | PASS |
| 7. TDD estrito | Testes de comportamento (com e sem `fallbackValue`) escritos antes da implementação, cobrindo os três componentes | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | `usedFallback`, `extractedFacts`/dados extraídos e `reasoning` continuam presentes e verdadeiros em toda execução, com ou sem `fallbackValue` — inclusive quando o resultado final não é bloqueado pela avaliação de suficiência (FR-005, FR-006) | PASS |
| 9. Provider único no MVP | Sem mudança — único client suportado continua sendo o `openai` oficial | PASS |

Nenhuma violação não-justificada identificada. O único desvio (princípio 3) é a
mudança de produto pedida nesta própria feature, documentada explicitamente no spec
(FR-001) e não um efeito colateral não examinado. Seção "Complexity Tracking" não se
aplica.

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/` confirmam que a
mudança é puramente de tipo (`fallbackValue?`) mais um guard de comportamento
(`hasFallback`/`shouldFallback`) em cada componente — nenhuma entidade nova, nenhum
novo modo de configuração, nenhuma chamada adicional ao modelo. Gate PASS mantido.

## Project Structure

### Documentation (this feature)

```text
specs/003-optional-fallback/
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
│   ├── GroundedCall.ts            # fallbackValue?: TFallback; validação relaxada (rejeita só string vazia)
│   └── types.ts                   # GroundedCallConfig.fallbackValue?: TFallback
└── generators/
    ├── GroundedGenerator.ts       # variante de system prompt (com/sem fallback); guard hasFallback
    ├── GroundedExtractor.ts       # GroundedExtractionConfig.fallbackValue?; guard shouldFallback; buildEmptyData()
    └── GroundedEnricher.ts        # nenhuma mudança de código — herda o tipo já relaxado de GroundedCallConfig

tests/
├── unit/
│   ├── core/
│   │   └── GroundedCall.test.ts        # + construção sem fallbackValue; ainda rejeita string vazia
│   └── generators/
│       ├── GroundedGenerator.test.ts   # + modo livre sem fallbackValue (insuficiente, vazio, suficiente)
│       ├── GroundedExtractor.test.ts   # + modo bruto sem fallbackValue (nada extraído, parcial + strict, mensagem vazia)
│       └── GroundedEnricher.test.ts    # + confirmação de que o comportamento não muda sem fallbackValue
└── contract/
    └── generators/
        ├── GroundedGenerator.schema.test.ts   # Já existe — deve continuar passando sem alteração
        └── GroundedExtractor.schema.test.ts   # Já existe — deve continuar passando sem alteração
```

**Structure Decision**: Mesma estrutura de projeto único das features 001/002.
Nenhum diretório novo é criado. `GroundedEnricher.ts` não precisa de nenhuma mudança
de código — apenas herda a relaxação de tipo feita em `core/types.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Não aplicável — nenhuma violação de complexidade a justificar. O único desvio de
princípio (fallback deixa de ser obrigatório) é a própria mudança de produto pedida,
já registrada e justificada na tabela de Constitution Check acima, não uma
complexidade acidental de implementação.

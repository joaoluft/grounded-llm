# Implementation Plan: Suporte a modelo LangChain no GroundedCall (tracing LangSmith)

**Branch**: `006-langchain-model-support` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-langchain-model-support/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Adiciona um novo parâmetro opcional `langchainModel` a `GroundedCallConfig`,
mutuamente exclusivo com `client`/`apiKey`/`model`/`temperature`, permitindo que o
desenvolvedor forneça um chat model LangChain (`BaseChatModel`) já configurado como
backend alternativo ao client OpenAI nativo. Internamente, `GroundedCall` passa a
delegar a chamada de modelo a uma abstração `ModelClient` com duas implementações:
a existente (OpenAI direto via `client.beta.chat.completions.parse`) e uma nova
(`LangChainModelClient`), que extrai o JSON Schema já produzido por
`zodResponseFormat(...)` (`json_schema.schema`/`.name`) e chama
`langchainModel.withStructuredOutput(schema, { name }).invoke(messages)`, convertendo
mensagens para o formato de tuplas nativo do LangChain (`[["system", ...], ["user",
...]]`). A assinatura pública de `callModel` e o código dos três generators
(`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) não mudam — a mudança é
inteiramente interna a `GroundedCall`. `@langchain/core` entra como peerDependency
opcional (nunca exigida para o modo standalone).

## Technical Context

**Language/Version**: TypeScript sobre Node.js 20+ (mesma base das features
001-005)

**Primary Dependencies**: `zod`, `openai` (existentes, sem mudança) + `@langchain/core`
como **peerDependency opcional** (nova — `peerDependenciesMeta.optional: true`). Nenhum
import de runtime é necessário: o tipo `BaseChatModel` é referenciado só via `import
type` (apagado na compilação), e o adapter chama métodos (`withStructuredOutput`,
`.invoke`) diretamente na instância já fornecida pelo desenvolvedor, sem precisar
importar nada de `@langchain/core` em tempo de execução (ver research.md R2/R3). Como
devDependency, para tipar/testar o adapter em desenvolvimento

**Storage**: N/A (componentes stateless, sem persistência própria)

**Testing**: `vitest`. Modo standalone continua mockando
`openai.chat.completions.create`/`.parse()`. Modo LangChain testado com um fake
mínimo compatível com a interface `BaseChatModel` usada (`withStructuredOutput(...).
invoke(...)`), sem chamada real a nenhum provider

**Target Platform**: Node.js 20+ (server-side); mesma distribuição da lib (dual
ESM+CJS via `tsup`)

**Project Type**: library (extensão aditiva dentro da lib `grounded-llm` existente)

**Performance Goals**: Sem meta própria — o adapter LangChain adiciona apenas uma
verificação de configuração no constructor e, quando usado, uma chamada `.invoke()`
no lugar de `.parse()` (sem nenhum import adicional em runtime); nenhum overhead no
modo standalone

**Constraints**: Zero crescimento de dependências instaladas para quem não usa
`langchainModel` (FR-012/SC-005); `callModel` e os três generators não mudam de
assinatura nem de comportamento observável; `langchainModel` é mutuamente exclusivo
com `client`/`apiKey`/`model`/`temperature` (erro de config, nunca uso silencioso);
resultado (`GroundedCallResult`/`GroundedExtractionResult`) e tipos de erro
(`ModelUnavailableError`/`InvalidModelOutputError`) idênticos entre os dois modos

**Scale/Scope**: Novo arquivo `src/core/model-client.ts` (interface `ModelClient` +
implementação OpenAI extraída do `callModel` atual) e `src/core/langchain-model-
client.ts` (adapter novo). Ajustes em `src/core/types.ts` (campo `langchainModel` +
validação de exclusividade) e `src/core/grounded-call.ts` (constructor escolhe o
`ModelClient`; `callModel` delega a ele). `src/generators/grounded-generator.ts` e
`grounded-enricher.ts` não mudam (já usam `GroundedCallConfig` diretamente).
`src/generators/grounded-extractor.ts` **precisa** de um ajuste pontual: sua própria
`GroundedExtractionConfig` duplica os campos de `GroundedCallConfig` em vez de
estendê-la (mesma situação já enfrentada pela feature 004 com `tone`), então
`langchainModel?: BaseChatModel` precisa ser adicionado explicitamente a ela também.
Nenhuma mudança em nenhum schema de generator

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Mesma base das features anteriores: `.specify/memory/constitution.md` ainda está com
o template não preenchido; os princípios abaixo seguem o mesmo conjunto já usado nos
plans anteriores.

| Princípio | Gate | Status |
|---|---|---|
| 1. Library-first | Nenhum módulo público novo — `ModelClient`/`LangChainModelClient` são detalhes internos de `core/`, expostos apenas via o novo campo de config em `GroundedCallConfig` | PASS |
| 2. Nunca gerar sem contenção | O modo LangChain ainda exige saída aderente ao mesmo schema Zod/JSON Schema (via `withStructuredOutput`); nenhuma via de saída livre/sem validação é aberta | PASS |
| 3. Fallback obrigatório (já relaxado pela feature 003) | Não afetado — `fallbackValue` funciona de forma idêntica em ambos os modos | PASS (N/A) |
| 4. Extração antes de geração | Não afetado — a mudança é só sobre qual backend transporta a chamada, não sobre a lógica de extração/suficiência de cada componente | PASS |
| 5. Confiança é dado objetivo | Fora de escopo, sem mudança | PASS (N/A) |
| 6. Temperature zero por padrão | No modo LangChain, `temperature` não é aceito na config (o chat model já traz sua própria); no modo standalone, comportamento e default inalterados | PASS |
| 7. TDD estrito | Testes escritos antes da implementação para: exclusividade mútua (erro de config), dispatch correto do `ModelClient`, default de `maxContextTokens` (128k) no modo LangChain, conversão de mensagens, e mapeamento de erros do adapter | PASS (a verificar na fase de tasks/implementação) |
| 8. Observabilidade por design | `GroundedCallResult`/`GroundedExtractionResult` não ganham nem perdem campos; o tracing do LangSmith é um efeito colateral do ecossistema LangChain, não algo que este pacote implementa ou expõe diretamente | PASS |
| 9. Provider único no MVP | Esta feature adiciona um **backend alternativo opcional** (delegação a um chat model LangChain já configurado pelo desenvolvedor), não uma camada de abstração multi-provider própria do pacote. O caminho padrão (OpenAI direto) continua sendo o único "provider" que este pacote conhece/gerencia; o pacote nunca escolhe nem instancia um provider por trás do LangChain — quem faz isso é o próprio chat model fornecido pelo desenvolvedor. Não há aumento de complexidade de seleção de provider dentro do pacote | PASS — ver justificativa acima |

Nenhuma violação identificada que exija entrada em "Complexity Tracking".

**Re-check pós-Phase 1 (design)**: `data-model.md` e `contracts/` confirmam que o
design não introduz nenhuma entidade pública nova além de `langchainModel` na config,
não muda o formato de `GroundedCallResult`/`GroundedExtractionResult`, e mantém
`callModel` com a mesma assinatura pública usada pelos três generators. O adapter
LangChain é inteiramente interno a `core/`. Gate PASS mantido.

## Project Structure

### Documentation (this feature)

```text
specs/006-langchain-model-support/
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
│   ├── types.ts                     # + langchainModel?: BaseChatModel em GroundedCallConfig;
│   │                                 #   documenta exclusividade mútua com client/apiKey/model/temperature
│   ├── grounded-call.ts             # constructor: valida exclusividade mútua, escolhe o ModelClient
│   │                                 #   (OpenAiModelClient vs LangChainModelClient); callModel delega a
│   │                                 #   this.modelClient.parse(...) em vez de chamar this.client diretamente
│   ├── model-client.ts              # NOVO: interface ModelClient + OpenAiModelClient (lógica hoje em
│   │                                 #   callModel, extraída sem mudar comportamento)
│   ├── langchain-model-client.ts    # NOVO: LangChainModelClient — extrai json_schema.schema/.name do
│   │                                 #   response_format, converte messages p/ tuplas LangChain, chama
│   │                                 #   withStructuredOutput(...).invoke(...), mapeia erros
│   └── errors.ts                    # sem mudança de tipos; reaproveitado pelo novo adapter
└── generators/
    ├── grounded-generator.ts        # SEM mudança — já usa GroundedCallConfig diretamente
    ├── grounded-enricher.ts         # SEM mudança — já usa GroundedCallConfig diretamente
    └── grounded-extractor.ts        # + langchainModel?: BaseChatModel em GroundedExtractionConfig
                                      #   (config própria, não estende GroundedCallConfig — mesmo ajuste
                                      #   que a feature 004 precisou fazer para `tone`)

tests/
├── unit/core/
│   ├── grounded-call.test.ts         # + testes de exclusividade mútua e dispatch do ModelClient correto
│   └── langchain-model-client.test.ts # NOVO: testes do adapter com fake BaseChatModel (schema extraído,
│                                       #   conversão de mensagens, mapeamento de erros, default 128k)
├── unit/generators/                  # + testes de dispatch com langchainModel nos três componentes
└── contract/generators/              # SEM mudança — response_format/schemas dos generators não mudam
```

**Structure Decision**: Mesma estrutura de projeto único das features anteriores.
A maior parte da mudança fica isolada em `src/core/` (dois arquivos novos + ajustes
pontuais em `types.ts`/`grounded-call.ts`). `grounded-generator.ts`/`grounded-
enricher.ts` não precisam mudar, porque já delegam ao `GroundedCall.callModel`
herdado via `GroundedCallConfig`. `grounded-extractor.ts` precisa de um ajuste de
tipo pontual porque sua `GroundedExtractionConfig` é uma interface própria que
duplica os campos em vez de estender `GroundedCallConfig`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Não aplicável — nenhuma violação de complexidade a justificar.

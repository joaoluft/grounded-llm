# Research: GroundedGenerator

**Feature**: 001-grounded-generator | **Date**: 2026-07-15

## Overview

O Technical Context desta feature já vem largamente definido pelo planejamento prévio do
projeto (`CLAUDE.md`, seção "Insumos para /speckit.plan"), que fixa a stack para toda a lib
`grounded-llm`. As decisões abaixo cobrem apenas os pontos que essa base não resolve
explicitamente e que impactam o desenho do `GroundedGenerator`.

## Decisions

### Linguagem, build e testes

- **Decision**: TypeScript sobre Node.js 20+; build com `tsup` gerando ESM + CJS; testes com
  `vitest`.
- **Rationale**: Já definido como padrão do projeto para toda a lib, garantindo consistência
  entre os componentes futuros (`GroundedDecider`, `verification/`, etc.).
- **Alternatives considered**: N/A — decisão herdada do planejamento do projeto, não desta
  feature especificamente.

### Validação e output estruturado

- **Decision**: Zod para definir o schema de saída da extração/geração (`extracted_facts`,
  `sufficient_context`, `reasoning`, `final_answer`), aplicado via structured output do
  modelo de chat (LangChain `withStructuredOutput` ou equivalente na chamada direta).
- **Rationale**: Constitution do projeto (princípio 2) exige que toda saída consumida pela
  aplicação use structured output via JSON Schema/Zod, nunca texto livre sem schema.
- **Alternatives considered**: Parsing de texto livre com regex/heurística — rejeitado por
  violar o princípio de "nunca gerar sem contenção" e por ser frágil a variações de formatação
  do modelo.

### Integração standalone via client `openai` (revisado)

- **Decision**: `GroundedGenerator` usa o client oficial `openai` (npm) diretamente, sem
  dependência de LangChain ou de qualquer framework de orquestração. O componente recebe
  configuração própria no construtor (`apiKey`, `model`, `fallbackValue`, `temperature`), não um
  objeto de terceiros. Isso permite que a lib seja plugada como um node de função dentro de
  qualquer pipeline (LangGraph, chain manual, ou chamada direta), sem exigir que o chamador
  implemente ou dependa de tipos externos.
- **Rationale**: Resolve a User Story 3 (integração sem reescrever retrieval) de forma mais
  flexível que uma dependência específica de LangChain — o desenvolvedor continua sem precisar
  alterar sua lógica de retrieval, e ganha a liberdade de usar o componente em qualquer
  orquestração, não apenas em projetos já acoplados ao LangChain. Também simplifica a
  superfície de dependências da lib (nenhuma peer dependency de terceiros nesta feature).
- **Alternatives considered**: Integração via `BaseChatModel` do LangChain (decisão da versão
  anterior deste research) — descartada por instrução explícita do usuário: acoplar o
  componente a uma interface de terceiros contradiz o objetivo de a lib ser standalone e
  plugável em qualquer pipeline.

### Structured output via `zodResponseFormat`

- **Decision**: Usar `zodResponseFormat` (do pacote `openai`) para converter o schema Zod de
  saída (`extracted_facts`, `sufficient_context`, `reasoning`, `final_answer`) em JSON Schema
  com `strict: true`, passado como `response_format` na chamada
  `openai.chat.completions.create`.
- **Rationale**: É o mecanismo oficial do client `openai` para structured output com
  garantia de aderência ao schema (`strict: true`), cumprindo o princípio 2 da constitution
  ("nunca gerar sem contenção") sem depender de parsing manual ou de uma camada de terceiros
  como o `withStructuredOutput` do LangChain.
- **Alternatives considered**: `withStructuredOutput` do LangChain — descartado junto com a
  remoção da dependência de LangChain desta feature.

### Extração de fatos e decisão de suficiência em uma única chamada estruturada

- **Decision**: Extração de `extracted_facts`, decisão de `sufficient_context`, `reasoning` e
  `final_answer` (quando aplicável) ocorrem em uma única chamada ao modelo, usando um schema
  Zod único que força esses quatro campos na saída.
- **Rationale**: Simplicidade (uma chamada, um custo de latência) e o schema já impõe a ordem
  lógica (extração → suficiência → resposta) como uma dependência de campos dentro do próprio
  prompt/schema, sem precisar de duas chamadas separadas ao modelo. Reduz superfície de falha
  técnica (uma chamada a menos que pode falhar/expirar).
- **Alternatives considered**: Duas chamadas separadas (uma para extração+suficiência, outra
  para geração condicionada) — rejeitada nesta fase por adicionar latência e complexidade sem
  benefício claro para o MVP; pode ser reavaliada se testes mostrarem que uma única chamada
  compromete a qualidade da extração.

### Detecção de contexto que excede o limite do modelo (FR-011)

- **Decision**: Antes de chamar `openai.chat.completions.create`, o componente estima o tamanho
  em tokens do prompt (contexto + pergunta + instruções do schema) usando um tokenizador
  compatível com o modelo configurado (ex.: `tiktoken` ou equivalente), e compara contra um
  limite conhecido para o `model` informado. Se o limite for excedido, o componente
  lança/retorna um erro operacional distinto do fallback, sem truncar e sem chamar a API.
- **Rationale**: A clarificação da spec (FR-011) exige falha explícita, não truncamento
  silencioso. Estimar tokens antes da chamada evita depender apenas do erro bruto da API, que
  poderia ser ambíguo ou vir só depois de gastar uma chamada.
- **Alternatives considered**: Confiar apenas no erro retornado pela API OpenAI quando o
  contexto excede o limite — rejeitado porque esse erro não é sempre distinguível de outros
  erros técnicos de forma confiável, dificultando o requisito de sinalização distinta.

### Configuração no construtor

- **Decision**: `apiKey` (opcional, default lido de `OPENAI_API_KEY`), `model` (default
  `"gpt-4o-mini"`), `fallbackValue` (obrigatório, sem default), `temperature` (default `0`).
- **Rationale**: Segue o padrão comum de clients OpenAI (variável de ambiente como default de
  credencial) e cumpre o princípio 3 (fallback obrigatório) e 6 (temperature zero por padrão)
  da constitution do projeto.
- **Alternatives considered**: Exigir `apiKey` sempre explícito — rejeitado por divergir da
  convenção usual do ecossistema `openai`/Node, sem ganho de segurança relevante.

### Mock do client nos testes

- **Decision**: Testes usam mock de `openai.chat.completions.create` — nenhuma chamada real à
  API OpenAI é feita em testes automatizados.
- **Rationale**: Constitution do projeto (princípio 7, TDD estrito) exige testes de
  comportamento com mock do client, sem chamada real.
- **Alternatives considered**: N/A — requisito não negociável do projeto.

## Outstanding Items

Nenhum item do Technical Context permanece como NEEDS CLARIFICATION após esta pesquisa.

# Research: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Feature**: 002-generator-family | **Date**: 2026-07-15

## Overview

A base técnica (TypeScript, `zod`, `openai`, `vitest`, `GroundedCall`) já está fixada
pela feature 001. As decisões abaixo cobrem apenas o desenho específico desta feature:
como o `GroundedEnricher` e o `GroundedExtractor` se encaixam na base compartilhada, e
como resolver as decisões tomadas na clarificação do spec (fallback do Enricher =
texto-base inalterado; fallback do Extractor = objeto completo + modo `strict`).

## Decisions

### Reaproveitamento do tipo de resultado para o GroundedEnricher

- **Decision**: `GroundedEnricher` reaproveita o mesmo tipo público `GroundedCallResult`
  já usado pelo `GroundedGenerator` (`finalAnswer`, `usedFallback`, `extractedFacts`,
  `reasoning`), em vez de criar um tipo de resultado próprio.
- **Rationale**: O planejamento geral do projeto (`CLAUDE.md`, Fase 4 —
  Observabilidade) já previa padronizar o formato de retorno entre componentes da lib.
  `GroundedEnricher` e `GroundedGenerator` têm exatamente o mesmo formato de saída
  (texto + flag de fallback + fatos + raciocínio) — apenas o significado semântico do
  texto muda (resposta final vs. texto enriquecido). Reaproveitar o tipo evita
  duplicação e mantém a API da lib consistente para quem já usa o `GroundedGenerator`.
- **Alternatives considered**: Criar um `GroundedEnrichmentResult` próprio — rejeitado
  por não agregar valor (mesma forma), apenas duplicando o tipo.

### Nome do campo de saída estruturada do GroundedEnricher

- **Decision**: O schema Zod interno do `GroundedEnricher` usa o campo
  `enriched_text` (em vez de `final_answer`) para a saída gerada pelo modelo, mesmo
  reaproveitando `GroundedCallResult.finalAnswer` no tipo público mapeado.
- **Rationale**: O nome do campo no schema (enviado ao modelo via `zodResponseFormat`)
  é parte da instrução que o modelo recebe — `enriched_text` comunica melhor a
  intenção ("enriqueça o texto-base") do que reaproveitar `final_answer`, que sugere
  uma resposta a uma pergunta. O tipo público (`GroundedCallResult.finalAnswer`)
  continua consistente entre os componentes; só o nome do campo cru do schema difere.
- **Alternatives considered**: Reaproveitar `final_answer` também no schema interno —
  rejeitado por ser uma instrução mais confusa para o modelo neste contexto.

### Fluxo do GroundedEnricher (fallback = texto-base inalterado)

- **Decision**: O schema estruturado do `GroundedEnricher` inclui `extracted_facts`,
  `sufficient_context`, `reasoning`, `enriched_text` (mesma forma do
  `GroundedGenerator`). Quando `sufficient_context = false` (ou nenhum fato extraído),
  o componente NÃO usa `enriched_text` do modelo — em vez disso, mapeia o resultado
  para `finalAnswer = baseContent` (o texto-base original, inalterado) e
  `usedFallback = true`. O `fallbackValue` configurado só é usado quando o próprio
  `baseContent` for inválido (vazio/em branco — tratado como erro de uso, ver
  Edge Cases do spec).
- **Rationale**: Implementa diretamente a decisão de FR-106: o "fallback" observável
  (`usedFallback = true`) sinaliza "nenhum enriquecimento aplicado," mas o valor
  retornado é o texto-base, não uma string de fallback genérica — preservando a
  resposta original do desenvolvedor em vez de substituí-la por um placeholder.
- **Alternatives considered**: Sempre usar `fallbackValue` quando insuficiente (como o
  `GroundedGenerator`) — rejeitado explicitamente pela decisão do usuário na
  clarificação do spec (Q1 = C).

### Schema do GroundedExtractor: campos opcionais para permitir extração parcial

- **Decision**: A API pública do `GroundedExtractor` aceita `fields` como um
  `ZodRawShape` puro (ex.: `{ name: z.string(), email: z.string() }`), não uma
  instância `z.ZodObject` já construída — o próprio construtor do `GroundedExtractor`
  chama `z.object(fields)` internamente. O `GroundedExtractor` então constrói seu
  schema de saída estruturada envolvendo esse objeto e tornando cada campo
  `.nullable()` internamente (a exigência de "obrigatório" ou não para o
  desenvolvedor é sobre o *dado do domínio*, não sobre a possibilidade de o modelo
  não conseguir extrair aquele campo). Um campo `reasoning: z.string()` é adicionado
  ao schema para o raciocínio da extração.
- **Rationale (forma de `fields`)**: Aceitar um `ZodRawShape` (objeto simples de
  schemas Zod por campo) em vez de exigir que o desenvolvedor já monte um
  `z.object(...)` é mais ergonômico — é o mesmo padrão que a própria API do Zod usa
  em `z.object(shape)`, e evita que o desenvolvedor precise conhecer os detalhes de
  como o `GroundedExtractor` deriva `fallbackValue`/`data` a partir do shape.
- **Rationale**: Permitir que qualquer campo individual seja `null` é o mecanismo que
  possibilita a extração parcial (FR-206, FR-211/212) — sem isso, `zodResponseFormat`
  com `strict: true` obrigaria o modelo a preencher todos os campos, impedindo
  representar "não encontrado."
- **Alternatives considered**: Exigir que o desenvolvedor já defina os campos como
  opcionais/nullable no próprio schema fornecido — rejeitado por empurrar uma
  preocupação de implementação (nullability do modelo) para a API pública do
  desenvolvedor, que deveria poder definir os campos do jeito mais natural.

### Lógica de fallback e modo strict do GroundedExtractor

- **Decision**: Após receber a saída (`Partial<Fields>` com campos possivelmente
  `null`, mais `reasoning`):
  - Se **todos** os campos vierem `null` → retorna `fallbackValue` (objeto completo)
    e `usedFallback = true` (FR-206).
  - Se **nenhum** campo vier `null` (extração completa) → retorna os valores
    extraídos e `usedFallback = false`.
  - Se **alguns** campos vierem `null` (extração parcial):
    - `strict = false` (default): retorna o objeto parcial (campos extraídos +
      `null` nos ausentes) e `usedFallback = false` (FR-212).
    - `strict = true`: retorna `fallbackValue` (objeto completo) e
      `usedFallback = true` (FR-211).
- **Rationale**: Implementa diretamente as decisões de clarificação do spec (Q2 = C,
  Q3 = B + parâmetro `strict`).
- **Alternatives considered**: Calcular uma "taxa de completude" e usar um threshold
  numérico configurável — rejeitado por adicionar complexidade não pedida; o binário
  strict/non-strict já cobre os cenários descritos no spec.

### Ajuste no GroundedGenerator: descrições de campo

- **Decision**: Adicionar `.describe(...)` a cada campo de
  `groundedGenerationSchema` (`extracted_facts`, `sufficient_context`, `reasoning`,
  `final_answer`), sem alterar tipos, nomes de campo, ou qualquer lógica de mapeamento
  em `GroundedGenerator.ts`.
- **Rationale**: `zodResponseFormat` inclui a `.describe()` de cada campo no JSON
  Schema enviado ao modelo (como `description`), o que pode melhorar a qualidade da
  decisão do modelo sem qualquer mudança de comportamento observável do lado do
  código — daí FR-302 (sem regressão) ser trivialmente satisfeito.
- **Alternatives considered**: Nenhuma — mudança direta, sem ambiguidade.

### Personalização de comportamento (identity/rules) — implementação compartilhada em GroundedCall

- **Decision**: `identity` e `rules` são adicionados a `GroundedCallConfig` (usado por
  `GroundedGenerator`/`GroundedEnricher`) e a `GroundedExtractionConfig` (usado por
  `GroundedExtractor`), com os mesmos nomes de campo nos dois. A lógica de composição
  do prompt final — anexar `identity` e depois `rules` como seções extras, sempre
  depois de um `basePrompt` — vive em um único método protegido,
  `GroundedCall.buildSystemPrompt(basePrompt: string): string`, reaproveitado pelos
  três componentes. Cada `SYSTEM_PROMPT`/`SYSTEM_PROMPT_PREFIX` interno de cada
  componente permanece intocado; a chamada ao modelo passa a usar
  `this.buildSystemPrompt(SYSTEM_PROMPT)` em vez do texto cru.
- **Rationale**: Como os três componentes já herdam de `GroundedCall` (decisão da
  feature 001, reforçada por esta feature), colocar a lógica de composição na base
  evita triplicar a mesma implementação e garante uma única fonte de verdade para a
  ordem (base → identity → rules) e para o enquadramento textual ("Additional rules
  for this call (these do not override the grounding rules above)"), que é a
  garantia de segurança central de FR-403.
- **Alternatives considered**: Implementar a composição separadamente em cada um dos
  três componentes — rejeitada por duplicar lógica idêntica e criar risco de a ordem
  ou o enquadramento divergirem entre componentes ao longo do tempo.
- **Nota de processo**: Esta capacidade foi implementada diretamente (sem rodar
  `/speckit-clarify`/`/speckit-plan`/`/speckit-tasks` formalmente antes de escrever
  código), por acordo explícito do usuário dado o escopo pequeno e bem contido. Este
  documento e `spec.md`/`data-model.md`/`contracts/`/`tasks.md` foram atualizados
  retroativamente para refletir o que foi implementado.

## Outstanding Items

Nenhum item do Technical Context permanece como NEEDS CLARIFICATION após esta
pesquisa.

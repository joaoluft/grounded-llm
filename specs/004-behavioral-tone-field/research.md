# Research: Campo opcional de comportamento/tom para a família de generators

**Feature**: 004-behavioral-tone-field | **Date**: 2026-07-16

## Overview

A base técnica já está fixada pelas features anteriores. As duas decisões que
precisavam de input do usuário (nome do campo, ordem de composição) já foram
resolvidas na fase de especificação (ver spec.md § Clarifications). Esta seção
documenta o raciocínio de design restante.

## Decisions

### Reaproveitar `buildSystemPrompt` em vez de um novo mecanismo de composição

- **Decision**: `tone` é composto pelo mesmo método `protected buildSystemPrompt(basePrompt: string): string` já existente em `GroundedCall`, que passa a também ler `this.tone` além de `this.identity`/`this.rules`.
- **Rationale**: `identity`/`rules` já resolveram exatamente o mesmo problema (texto livre, opcional, sempre depois das instruções internas, nunca as sobrescrevendo) na feature 002. Introduzir um mecanismo de composição paralelo só para `tone` duplicaria lógica já testada e aumentaria a chance de os três componentes divergirem em como tratam string vazia ou ordem de composição.
- **Alternatives considered**: Um novo método `buildSystemPromptWithTone` — rejeitado por YAGNI; a extensão do método existente é suficiente e mantém um único ponto de verdade para a regra "nunca sobrescreve as instruções internas".

### GroundedExtractor: campo próprio em vez de estender GroundedCallConfig

- **Decision**: `GroundedExtractionConfig` (interface própria do `GroundedExtractor`, que não estende `GroundedCallConfig`) ganha seu próprio campo `tone?: string`, espelhando como `identity`/`rules` já foram adicionados lá na feature 002.
- **Rationale**: `GroundedExtractor` já declara `identity`/`rules` na sua própria interface de configuração (em vez de herdar de `GroundedCallConfig`), porque seu tipo de fallback (`ExtractionData<Fields>`) é genérico sobre `Fields`, não sobre `TFallback` simples. `tone` segue exatamente o mesmo padrão já estabelecido — nenhuma refatoração de tipos é necessária, só espelhar o campo já usado para `identity`/`rules`.
- **Alternatives considered**: Extrair uma interface `PersonalizationConfig { identity?; rules? }` compartilhada entre `GroundedCallConfig` e `GroundedExtractionConfig` — rejeitado como escopo não pedido (refatoração de tipos que a feature não exige); pode ser considerado no futuro se um quarto campo de personalização for adicionado, mas não se justifica para este terceiro campo isolado.

### String vazia/em branco tratada como "não configurado"

- **Decision**: Assim como `identity`/`rules`, se `tone` for uma string vazia ou só espaços, `buildSystemPrompt` não inclui a seção correspondente no prompt.
- **Rationale**: Consistência com o comportamento já estabelecido para `identity`/`rules` (o método já checa `if (this.identity)`/`if (this.rules)`, que são falsy para string vazia) — o usuário não pediu uma regra diferente para `tone`, e divergir aqui criaria uma inconsistência de comportamento entre os três campos de personalização.
- **Alternatives considered**: Lançar erro de configuração inválida para `tone` vazio — rejeitado; nenhum dos outros dois campos de personalização faz isso, e não há motivo de domínio para tratar `tone` como mais crítico que `identity`/`rules`.

### Ordem de composição: identity → rules → tone

- **Decision**: Quando múltiplos campos de personalização são configurados juntos, a ordem de composição no prompt é: instruções internas do componente → `identity` → `rules` → `tone`.
- **Rationale**: Confirmado com o usuário (spec.md § Clarifications). A lógica: papel/objetivo (`identity`) estabelece o "quem"; regras (`rules`) estabelecem restrições adicionais; tom (`tone`) é a camada final de estilo, mais próxima da geração da resposta em si.
- **Alternatives considered**: `identity → tone → rules` e `tone → identity → rules` foram apresentadas como alternativas ao usuário e não escolhidas.

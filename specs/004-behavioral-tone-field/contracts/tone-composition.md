# Contract: Composição de `tone` no system prompt (todos os componentes)

**Feature**: 004-behavioral-tone-field | **Date**: 2026-07-16

Este contrato documenta o que muda em `GroundedCall.buildSystemPrompt` (reutilizado
por `GroundedGenerator`, `GroundedEnricher`, e reimplementado com a mesma regra em
`GroundedExtractor`, que tem sua própria interface de configuração).

## Construção

- `tone` (string) — opcional, sem valor default, disponível em `GroundedGenerator`,
  `GroundedEnricher` (via `GroundedCallConfig`) e `GroundedExtractor` (via
  `GroundedExtractionConfig`).

## Regras de comportamento observável (derivadas do spec)

1. Quando `tone` não é configurado, ou é uma string vazia/em branco → o system prompt
   enviado ao modelo é **idêntico** ao comportamento anterior a esta feature (FR-005).
2. Quando `tone` é configurado com um valor não vazio → o system prompt enviado ao
   modelo inclui uma seção adicional com esse conteúdo, **sempre depois** das
   instruções internas de ancoragem/anti-alucinação do componente (FR-002).
3. Quando `identity`, `rules`, e/ou `tone` são configurados juntos, a ordem relativa
   entre as seções adicionais no prompt é sempre: `identity` → `rules` → `tone`
   (FR-003). Qualquer subconjunto desses três campos mantém essa mesma ordem relativa
   entre os presentes.
4. `tone` nunca substitui, contradiz, ou aparece antes das instruções internas de
   ancoragem/anti-alucinação — ele é sempre texto adicional ao final (FR-004).
5. O comportamento é idêntico entre os três componentes: mesma regra de "vazio =
   omitido", mesma posição relativa no prompt (FR-006).

## Compatibilidade retroativa

Nenhum consumidor que já configura `identity`/`rules` hoje observa qualquer diferença
de comportamento nessas duas seções — `tone` é estritamente aditivo, e sua ausência
(caso padrão para todo consumidor existente) resulta no mesmo prompt de antes desta
feature (FR-007).

# Research: fallbackValue opcional na família de generators

**Feature**: 003-optional-fallback | **Date**: 2026-07-16

## Overview

A base técnica (TypeScript, `zod`, `openai`, `vitest`, `GroundedCall`) já está fixada
pelas features 001/002. Todas as decisões de comportamento desta feature já vieram
definidas pelo usuário durante a conversa que originou o spec — não há
`[NEEDS CLARIFICATION]` a resolver. As seções abaixo documentam o raciocínio por trás
de cada decisão, para referência de quem for implementar ou revisar.

## Decisions

### Sinal único para o novo comportamento: presença de `fallbackValue`

- **Decision**: Nenhum novo parâmetro de configuração (ex.: `strictGrounding: boolean`)
  é introduzido. O comportamento de cada componente é inteiramente determinado por
  `this.fallbackValue !== undefined`.
- **Rationale**: O próprio ato de omitir `fallbackValue` já expressa a intenção do
  desenvolvedor ("não quero um valor fixo aqui") — introduzir uma segunda flag para a
  mesma decisão duplicaria o controle e criaria combinações inconsistentes (ex.:
  `fallbackValue` configurado + `strictGrounding: false`) sem nenhum caso de uso que
  as justifique.
- **Alternatives considered**: Uma flag explícita separada — rejeitada por violar
  YAGNI; a presença/ausência de `fallbackValue` já é suficiente e inequívoca.

### `GroundedGenerator` sem fallback: uma única chamada ao modelo, prompt condicional

- **Decision**: Em vez de fazer uma segunda chamada ao modelo quando o contexto é
  julgado insuficiente e não há `fallbackValue`, o `GroundedGenerator` seleciona, antes
  da (única) chamada, uma variante do system prompt: com `fallbackValue` configurado,
  o passo 4 instrui o modelo a deixar `final_answer` vazio quando insuficiente; sem
  `fallbackValue`, o mesmo passo instrui o modelo a sempre responder da melhor forma
  possível (conhecimento geral, ou pedir mais informação), nunca deixando
  `final_answer` vazio.
- **Rationale**: Uma segunda chamada dobraria a latência e o custo de toda chamada com
  contexto insuficiente, para um resultado que o modelo já é capaz de produzir na
  mesma chamada — o "julgamento de suficiência" e a "resposta livre" não são
  logicamente dependentes o suficiente para justificar serializar duas chamadas.
  `sufficient_context`, `extracted_facts` e `reasoning` continuam sendo preenchidos
  com a mesma sinceridade em ambos os modos, preservando a observabilidade (princípio
  8) mesmo quando o resultado final não é mais bloqueado por essa avaliação.
- **Alternatives considered**: Duas chamadas (uma para avaliar suficiência, outra para
  responder livremente só se necessário) — rejeitada por custo/latência extra sem
  ganho de qualidade perceptível; o schema já suporta ambos os campos numa única
  resposta estruturada.

### Contexto vazio/em branco sem fallback: chamar o modelo mesmo assim

- **Decision**: O curto-circuito atual (retornar o fallback sem chamar o modelo
  quando `context` é vazio/em branco) só se aplica quando `fallbackValue` está
  configurado. Sem fallback, o modelo é chamado normalmente, com `context` vazio.
- **Rationale**: Sem um valor fixo para retornar, "não chamar o modelo" deixaria o
  chamador sem nenhum resultado utilizável. Chamar o modelo com contexto vazio ainda é
  seguro — a variante "sem fallback" do prompt já instrui o modelo a responder com
  conhecimento geral ou pedir mais informação, então o comportamento é consistente com
  o caso de contexto insuficiente (mesma instrução, mesmo schema).
- **Alternatives considered**: Lançar erro de uso inválido quando contexto e fallback
  estão ambos ausentes — rejeitado; o usuário confirmou explicitamente que prefere que
  o modelo ainda produza uma resposta nesse caso, e nada nos requisitos do domínio
  (geração de texto genérica) torna "contexto vazio" um estado logicamente inválido
  para uma chamada de geração.

### `GroundedExtractor` sem fallback: `strict` é ignorado, nunca lança erro

- **Decision**: Um único guard `shouldFallback = hasFallback && (allNull || (someNull
  && this.strict))` substitui a lógica anterior (que sempre usava `fallbackValue` nos
  mesmos dois casos). Quando `fallbackValue` não está configurado, `shouldFallback` é
  sempre `false`, então `extract()` sempre retorna os dados brutos extraídos pelo
  modelo (com `null` nos campos ausentes), independentemente de `strict`.
- **Rationale**: `strict` existe para decidir *o que fazer quando falta um objeto de
  fallback para substituir* — sem `fallbackValue`, não há nada para `strict`
  escolher entre "aceitar parcial" ou "usar o fallback completo"; a única opção
  coerente é sempre devolver o que foi extraído. Ignorar `strict` silenciosamente
  (em vez de lançar erro de configuração inválida) mantém a mesma filosofia do
  `GroundedGenerator`: ausência de fallback nunca impede o componente de produzir um
  resultado.
- **Alternatives considered**: Lançar erro na construção se `strict: true` for
  combinado com `fallbackValue` ausente — rejeitado; o usuário preferiu
  explicitamente que o `strict` seja apenas ignorado, mantendo a API mais simples e
  sem uma nova classe de erro de configuração para um caso que já tem uma
  interpretação razoável (sempre parcial).

### `GroundedExtractor` sem fallback e mensagem vazia: retorna nulls sem chamar o modelo

- **Decision**: O curto-circuito de mensagem vazia/em branco já delega para o mesmo
  método (`buildFallbackResult`), que passa a ramificar internamente: com
  `fallbackValue` configurado, retorna o objeto de fallback (`usedFallback: true`);
  sem `fallbackValue`, retorna um objeto com todos os campos em `null`
  (`usedFallback: false`), sem chamar o modelo em nenhum dos dois casos.
- **Rationale**: Diferente do `GroundedGenerator` (onde contexto vazio ainda pode
  gerar uma resposta via conhecimento geral do modelo), uma mensagem vazia no
  `GroundedExtractor` não tem nenhum conteúdo do qual extrair campos — chamar o
  modelo não agregaria informação nova; o resultado correto (`null` em todos os
  campos) já é conhecido sem custo de chamada.
- **Alternatives considered**: Chamar o modelo mesmo com mensagem vazia, por simetria
  com o `GroundedGenerator` — rejeitado; não há informação para o modelo processar, e
  evitar a chamada preserva o comportamento de custo zero que a mensagem vazia já tem
  hoje (com fallback configurado).

### `GroundedEnricher`: nenhuma mudança de comportamento

- **Decision**: `GroundedEnricher.ts` não recebe nenhuma alteração de código nesta
  feature. A relaxação de `GroundedCallConfig.fallbackValue` para opcional (em
  `core/types.ts`) já é suficiente para permitir construí-lo sem `fallbackValue`.
- **Rationale**: O `GroundedEnricher` já nunca retornava `fallbackValue` em nenhum
  caminho de execução — contexto insuficiente sempre resulta em `baseContent`
  inalterado (decisão tomada na feature 002, FR-106). `fallbackValue` já era, na
  prática, um campo de configuração sem efeito observável no `GroundedEnricher`;
  torná-lo opcional apenas remove uma exigência de construção artificial, sem
  nenhuma outra consequência.
- **Alternatives considered**: N/A — não há decisão de comportamento a tomar aqui, só
  confirmar que nenhuma mudança de código é necessária além do tipo compartilhado.

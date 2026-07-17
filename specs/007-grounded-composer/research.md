# Phase 0 Research: GroundedComposer

Nenhum item do Technical Context ficou marcado como `NEEDS CLARIFICATION` — todas as
decisões abaixo resolvem ambiguidades de design levantadas durante a conversa que
originou esta feature, antes de chegarem ao spec.

## Decisão 1: Nome do campo de entrada (`instructions`, não `rules`)

**Decision**: O campo de entrada por chamada que carrega as instruções obrigatórias
se chama `instructions`, não `rules`.

**Rationale**: `GroundedCallConfig.rules` já existe como campo estático, configurado
uma vez na construção do componente (personalização transversal via
`buildSystemPrompt()`, compartilhada por toda a família). Reutilizar o nome `rules`
para o campo dinâmico por chamada do `GroundedComposer` colidiria conceitualmente
(dois "rules" com escopos e ciclos de vida diferentes) mesmo não havendo colisão de
tipo em TypeScript (um é `GroundedCallConfig.rules`, outro seria
`ComposerRequest.rules`). `instructions` comunica corretamente que é a entrada
variável de cada chamada, análoga a `context` em `GenerationRequest`/`EnrichmentRequest`.

**Alternatives considered**: manter `rules` no request (rejeitado — ambiguidade de
leitura em código que usa os dois: `config.rules` vs `request.rules`); `directive`
(rejeitado — menos alinhado ao vocabulário já usado no domínio, que fala em "regras
do campo pendente").

## Decisão 2: Sem `fallbackValue` para este componente

**Decision**: `GroundedComposer` não aceita/exige `fallbackValue` — o parâmetro
continua existindo em `GroundedCallConfig` (compartilhado), mas o componente nunca o
lê nem o expõe como caminho de resultado.

**Rationale**: O comportamento central da feature (FR-705) é que a mensagem final é
sempre produzida a partir de `instructions` — não existe, para este componente, uma
noção de "instructions insuficientes" que justifique um fallback. Diferente de
`GroundedEnricher` (FR-105 da feature 002), que exige `fallbackValue` só por
consistência de API mesmo sem um caminho de código que o invoque, aqui nem isso se
justifica: exigir um valor que nunca é lido criaria uma API enganosa (o desenvolvedor
seria levado a pensar que existe um cenário de fallback). Essa omissão é deliberada e
documentada na Constitution Check (princípio 3, marcado N/A), não uma violação
silenciosa.

**Alternatives considered**: exigir `fallbackValue` por consistência com os outros
três componentes (rejeitado — API enganosa, ver acima); tornar `fallbackValue`
opcional e ignorado (rejeitado — mesmo problema, apenas adiado).

## Decisão 3: Reutilizar `GroundedCallResult` sem tipo próprio

**Decision**: O resultado público do `GroundedComposer` usa o mesmo tipo
`GroundedCallResult` (`finalAnswer`, `usedFallback`, `extractedFacts`, `reasoning`)
já usado por `GroundedGenerator`/`GroundedEnricher`, com o seguinte mapeamento:
`finalAnswer` ← `final_message`; `usedFallback` ← sempre `false`; `extractedFacts` ←
concatenação de `applied_rules` e `context_excerpts` (nesta ordem, sem separador
especial — cada trecho continua sendo um item de array, apenas de duas fontes
diferentes); `reasoning` ← `reasoning`.

**Rationale**: Mantém a família de generators com uma superfície pública consistente
(mesmo padrão usado pela feature 002 ao decidir reaproveitar `GroundedCallResult`
para o `GroundedEnricher` em vez de criar um tipo próprio). `usedFallback` sempre
`false` é o sinal observável, testável, de que este componente nunca se abstém
(SC-001).

**Alternatives considered**: criar um `GroundedComposerResult` com campos próprios
(`appliedRules`, `contextUsed`, `contextExcerpts`) em vez de reaproveitar
`GroundedCallResult` (rejeitado para o MVP — quebraria a consistência de superfície
pública da família sem necessidade; pode ser revisitado se `context_used` precisar
ser exposto como booleano distinto no futuro, hoje inferível pela presença/ausência
de trechos de `context` em `extractedFacts` combinada com `reasoning`).

## Decisão 4: Schema estruturado dedicado, sem reaproveitar `groundedGenerationSchema`

**Decision**: Novo arquivo `grounded-composer.schema.ts` com um schema próprio
(`groundedCompositionSchema`), não uma variação do schema do `GroundedGenerator`.

**Rationale**: Os campos têm semântica invertida (`sufficient_context` vira
`context_used`, com significado oposto: aqui `true` nunca bloqueia a saída) e
`extracted_facts`/`final_answer` viram `applied_rules`/`context_excerpts`/
`final_message` — compartilhar o schema do `GroundedGenerator` exigiria campos
opcionais ou reinterpretados, aumentando a chance de um consumidor da lib confundir
os dois contratos. Um schema dedicado, no mesmo padrão de arquivo já usado por
`grounded-enricher.schema.ts`, mantém cada contrato explícito e auto-descritivo.

**Alternatives considered**: estender `groundedGenerationSchema` com campos opcionais
(rejeitado — normalizaria a confusão entre os dois paradigmas que motivou esta feature).

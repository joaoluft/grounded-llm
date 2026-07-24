# Contract: GroundedComposer (Public API)

**Feature**: 007-grounded-composer | **Date**: 2026-07-17

## Construção

Mesma forma de `GroundedCallConfig` (ver `core/types.ts`), **exceto** que
`fallbackValue` não é lido nem exigido por este componente (ver research.md Decisão 2):
`client`/`apiKey`/`model`/`langchainModel` (opcionais, mesma regra de resolução dos
demais componentes), `temperature` (default `0`), `maxContextTokens`, `identity`
(opcional), `rules` (opcional — personalização estática da chamada, distinta de
`ComposerRequest.instructions`, ver research.md Decisão 1), `tone` (opcional).

## Operação principal: compor mensagem

**Entrada** (`ComposerRequest`):

- `instructions` (string, obrigatório) — vazio/em branco MUST ser rejeitado
  imediatamente como uso inválido, sem chamar o modelo (FR-703).
- `context` (string, opcional) — ausente/vazio/em branco é tratado como "sem dados de
  conversa disponíveis", não como erro nem como motivo de abstenção (FR-704).

**Saída em caso de sucesso** (`GroundedCallResult`, reaproveitado sem alteração de
forma — ver data-model.md):

- `finalAnswer` (string) — sempre não-vazia.
- `usedFallback` (boolean) — sempre `false`.
- `extractedFacts` (array de string) — `applied_rules` + `context_excerpts`.
- `reasoning` (string).

**Saída em caso de erro operacional**: mesmas categorias já definidas para os demais
componentes (`ModelUnavailableError`, `ContextTooLargeError`,
`InvalidModelOutputError`), reaproveitadas de `core/errors.ts` sem alteração (FR-711).

## Regras de comportamento observável (derivadas do spec)

1. Se `instructions` estiver vazio/em branco → erro de uso lançado imediatamente (não
   um `GroundedCallResult`).
2. Se `context` estiver ausente/vazio/em branco → a chamada ao modelo prossegue
   normalmente, usando apenas `instructions`; `usedFallback` continua `false` e
   `finalAnswer` é produzida (FR-704, FR-705). Não existe, para este componente, um
   caminho onde a ausência ou insuficiência de `context` impede ou substitui a
   mensagem.
3. `usedFallback` MUST ser sempre `false`, em toda chamada bem-sucedida — este
   componente nunca se abstém (FR-705, SC-001).
4. `extractedFacts` (via `applied_rules`) MUST ser sempre não-vazio em toda chamada
   bem-sucedida — `finalAnswer` MUST ser rastreável a pelo menos um trecho de
   `instructions` (FR-706, SC-002).
5. Quando trechos de `context` influenciarem `finalAnswer` (conflito, progresso,
   referência a dado já mencionado), esses trechos MUST aparecer em `extractedFacts`
   (via `context_excerpts`), e `reasoning` MUST conectá-los à mensagem final
   (FR-707, FR-708, FR-709).
6. Chamadas repetidas com a mesma `instructions` + `context` MUST produzir resultados
   consistentes (determinístico por padrão, `temperature` default `0`, FR-710).
7. Sem redação/mascaramento de dados sensíveis, sem retry automático, stateless entre
   chamadas — mesmas regras já estabelecidas para os demais componentes.
8. Se `identity`/`rules`/`tone` (da configuração, não de `ComposerRequest`) forem
   configurados, MUST aparecer nas instruções enviadas ao modelo como seção
   adicional, sempre depois das instruções internas de ancoragem do componente,
   mesma ordem e comportamento já estabelecidos por `buildSystemPrompt()` (FR-712).
9. `assertContextWithinLimit` MUST ser aplicado sobre o prompt completo
   (`instructions` + `context`, quando houver) antes de qualquer chamada ao modelo,
   mesma regra dos demais componentes (FR-713).

## Fora de escopo deste contrato

- `fallbackValue`: não é lido nem exposto por este componente (ver research.md
  Decisão 2) — construir um `GroundedComposer` com `fallbackValue` configurado não é
  um erro (o campo é compartilhado por `GroundedCallConfig`), mas o valor é
  simplesmente ignorado.
- Streaming, verificação de consistência pós-geração, providers além dos já
  suportados por `GroundedCall` (OpenAI/LangChain) — mesmas exclusões dos demais
  componentes.
- Cálculo de confiança via logprob (exclusivo do futuro `GroundedDecider`).
- Alteração de comportamento de `GroundedGenerator`, `GroundedEnricher` ou
  `GroundedExtractor` (FR-714).

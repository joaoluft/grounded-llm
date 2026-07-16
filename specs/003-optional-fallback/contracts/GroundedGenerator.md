# Contract: GroundedGenerator (Public API) — ajuste de fallbackValue opcional

**Feature**: 003-optional-fallback | **Date**: 2026-07-16

Este contrato documenta apenas o que muda em relação ao contrato já estabelecido nas
features 001/002. A assinatura pública (`GenerationRequest`, `GroundedCallResult`,
os três erros operacionais) não muda de forma.

## Construção

- `fallbackValue` (string) — **deixa de ser obrigatório**. Quando fornecido, ainda
  MUST ser rejeitado se vazio (mesma regra de hoje). Quando omitido, o componente
  entra no modo descrito abaixo.
- Todos os demais campos de `GroundedCallConfig` (`client`, `apiKey`, `model`,
  `temperature`, `maxContextTokens`, `identity`, `rules`) permanecem inalterados.

## Operação principal: gerar uma resposta

**Entrada** (`GenerationRequest`): inalterada — `context`, `question`.

**Saída** (`GroundedCallResult`): forma inalterada — `finalAnswer`, `usedFallback`,
`extractedFacts`, `reasoning`.

## Regras de comportamento observável (derivadas do spec)

### Com `fallbackValue` configurado (inalterado)

1. `context` vazio/em branco → `usedFallback = true`, `finalAnswer = fallbackValue`,
   **sem chamar o modelo** (FR-007).
2. Contexto insuficiente, contraditório, ou `sufficient_context` inconsistente com
   `extracted_facts` vazio → `usedFallback = true`, `finalAnswer = fallbackValue`
   (FR-007).
3. Contexto suficiente → `usedFallback = false`, `finalAnswer` derivado
   exclusivamente dos trechos extraídos.

### Sem `fallbackValue` configurado (novo)

4. `context` vazio/em branco → o modelo **é chamado mesmo assim**; `finalAnswer` é a
   resposta produzida por ele, `usedFallback = false` (FR-004).
5. Contexto insuficiente, contraditório, ou `extracted_facts` vazio →
   `finalAnswer` é a resposta produzida pelo modelo (nunca vazia — o modelo é
   instruído a responder com conhecimento geral ou pedir mais informação),
   `usedFallback = false` (FR-003, SC-003).
6. Contexto suficiente → mesmo comportamento do caso "com fallback": `usedFallback =
   false`, `finalAnswer` derivado dos trechos extraídos.
7. Em todos os casos acima, `sufficient_context` e `extracted_facts` continuam
   refletindo a avaliação real feita pelo modelo, mesmo quando não bloqueiam mais o
   resultado final (FR-005).

## Erros operacionais

Inalterado — mesmas três categorias já definidas na feature 001
(`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`), com ou
sem `fallbackValue` configurado.

## Compatibilidade retroativa

Todo o comportamento "Com `fallbackValue` configurado" acima é idêntico ao contrato
anterior a esta feature — nenhum consumidor existente que já configura
`fallbackValue` observa qualquer diferença (FR-012, SC-001).

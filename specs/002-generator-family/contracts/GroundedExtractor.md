# Contract: GroundedExtractor (Public API)

**Feature**: 002-generator-family | **Date**: 2026-07-15

## Construção

Entrada na construção (`GroundedExtractionConfig`, ver `data-model.md`):

- `fields` (obrigatório) — definição dos campos a extrair, fornecida pelo
  desenvolvedor.
- `fallbackValue` (objeto completo, mesmo formato de `fields`, obrigatório) —
  construir sem ele MUST falhar imediatamente.
- `strict` (boolean, opcional, default `false`) — controla se extração parcial é
  aceita.
- `client`/`apiKey`/`model`/`temperature`/`maxContextTokens` — mesma regra de
  resolução do `GroundedCallConfig` (feature 001).

## Operação principal: extrair dados

**Entrada** (`ExtractionRequest`):

- `message` (string, obrigatório) — vazia/em branco é informação insuficiente para
  qualquer campo.

**Saída em caso de sucesso, sucesso parcial, ou fallback** (`GroundedExtractionResult`):

- `data` (objeto no formato de `fields`, com valores extraídos ou `null` por campo
  quando `strict = false` e parcialmente extraído, ou igual a `fallbackValue` quando
  `usedFallback = true`)
- `usedFallback` (boolean)
- `reasoning` (string)

**Saída em caso de erro operacional**: mesmas três categorias já definidas na feature
001 (`ModelUnavailableError`, `ContextTooLargeError`, `InvalidModelOutputError`).

## Regras de comportamento observável (derivadas do spec)

1. Se `message` estiver vazia/em branco, ou nenhum campo puder ser extraído com
   segurança → `usedFallback = true`, `data = fallbackValue` (objeto completo).
2. Se todos os campos puderem ser extraídos com segurança → `usedFallback = false`,
   `data` contém todos os valores, rastreáveis a `message`.
3. Se apenas parte dos campos puder ser extraída com segurança:
   - `strict = false` (default): `usedFallback = false`, `data` contém os campos
     extraídos e `null` nos demais.
   - `strict = true`: `usedFallback = true`, `data = fallbackValue` (objeto
     completo) — nenhum resultado parcial é retornado.
4. Nenhum valor em `data` (quando `usedFallback = false`) MUST ser inventado além do
   que é suportado pelo texto de `message` (FR-203).
5. Chamadas repetidas com a mesma `message` e mesma configuração MUST produzir
   resultados consistentes (determinístico por padrão).
6. Sem cálculo de confiança via logprob, sem conjunto fechado de ações — esses
   requisitos pertencem exclusivamente ao futuro `GroundedDecider` (FR-210).
7. Sem retry automático, stateless entre chamadas, sem redação/mascaramento — mesmas
   regras já estabelecidas para os demais componentes da lib.

## Fora de escopo deste contrato

- Streaming, verificação de consistência pós-geração, suporte a providers além da
  OpenAI.
- Conjunto fechado de ações válidas e confiança via logprob (exclusivo do
  `GroundedDecider`).
- Definição dinâmica de `fields` por chamada (é fixada na construção do componente).

# Quickstart: fallbackValue opcional na família de generators

**Feature**: 003-optional-fallback | **Date**: 2026-07-16

Guia de validação end-to-end. Não contém código de implementação — apenas os passos e
cenários a rodar contra a implementação feita em `/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+, dependências já instaladas (`zod`, `openai`).
- Mock de `openai.chat.completions.create`/`.parse()` para testes locais (nenhuma
  chamada real à API), seguindo o mesmo padrão das features 001/002.

## Setup

```bash
npm install
npm run build
npm test
```

## Cenários de validação

### Cenário 1 — Retrocompatibilidade total (US2)

1. Rodar a suíte de testes já existente das features 001/002 sem nenhuma alteração
   de expectativa (`GroundedGenerator.test.ts`, `GroundedEnricher.test.ts`,
   `GroundedExtractor.test.ts`, testes de contrato/schema, evaluations).
2. **Esperado**: 100% dos testes já existentes continuam passando, exatamente como
   antes (SC-001).

### Cenário 2 — GroundedGenerator responde livremente sem fallbackValue (US1)

1. Construir `GroundedGenerator` sem `fallbackValue`.
2. Chamar com um `context` irrelevante para a `question` feita.
3. **Esperado**: `usedFallback = false`; `finalAnswer` contém a resposta real
   produzida pelo modelo (não vazia); `sufficient_context`/`extracted_facts`
   continuam refletindo a avaliação real de suficiência.

### Cenário 3 — GroundedGenerator chama o modelo mesmo com contexto vazio, sem fallbackValue (US1)

1. Construir `GroundedGenerator` sem `fallbackValue`.
2. Chamar com `context` vazio/em branco e uma `question` válida.
3. **Esperado**: o mock do client `openai` É chamado (diferente do caso com
   `fallbackValue`, que curto-circuita); `finalAnswer` contém a resposta do modelo,
   `usedFallback = false`.

### Cenário 4 — GroundedExtractor retorna dados brutos sem fallbackValue (US3)

1. Construir `GroundedExtractor` sem `fallbackValue`, com `strict: true`.
2. Chamar com uma mensagem que só preenche parte dos campos definidos.
3. **Esperado**: `strict` é ignorado; `data` contém os campos extraídos e `null` nos
   demais; `usedFallback = false`; nenhum erro é lançado.

### Cenário 5 — GroundedExtractor com mensagem vazia, sem fallbackValue (edge case)

1. Construir `GroundedExtractor` sem `fallbackValue`.
2. Chamar com `message` vazia/em branco.
3. **Esperado**: o mock do client `openai` NÃO é chamado; `data` é um objeto com
   todos os campos em `null`; `usedFallback = false`.

### Cenário 6 — GroundedEnricher inalterado com ou sem fallbackValue (US2)

1. Construir `GroundedEnricher` duas vezes: uma com `fallbackValue`, outra sem.
2. Chamar ambas com o mesmo `baseContent` e um `context` insuficiente para
   enriquecer com segurança.
3. **Esperado**: as duas chamadas retornam `finalAnswer = baseContent` (inalterado),
   `usedFallback = true`, em ambos os casos — nenhuma diferença de comportamento
   entre configurar ou não `fallbackValue`.

## Referências

- Regras completas de comportamento observável: `contracts/GroundedGenerator.md`,
  `contracts/GroundedExtractor.md`.
- Forma dos tipos afetados: `data-model.md`.
- Racional das decisões (por que uma única chamada, por que `strict` é ignorado, por
  que a mensagem vazia não chama o modelo): `research.md`.

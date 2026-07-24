# Quickstart: Suporte a modelo LangChain no GroundedCall

**Feature**: 006-langchain-model-support | **Date**: 2026-07-16

Guia de validação end-to-end. Não contém código de implementação — apenas os passos e
cenários a rodar contra a implementação feita em `/speckit-tasks` + implementação.

## Pré-requisitos

- Node.js 20+, dependências já instaladas (`zod`, `openai`).
- `@langchain/core` instalado como devDependency (necessário só para build/testes do
  próprio pacote; consumidores do modo standalone não precisam instalá-lo).
- Fake mínimo de `BaseChatModel` para os testes do modo LangChain (implementa
  `withStructuredOutput(schema, opts).invoke(messages)`, sem chamada real a nenhum
  provider).
- Mock de `openai.chat.completions.create`/`.parse()` para os testes do modo
  standalone (nenhuma chamada real à API), seguindo o mesmo padrão das features
  anteriores.

## Setup

```bash
npm install
npm run build
npm test
```

## Cenários de validação

### Cenário 1 — `langchainModel` é usado no lugar do client OpenAI (US1)

1. Construir `GroundedGenerator` com `langchainModel: <fake chat model>` (sem
   `client`/`apiKey`/`model`/`temperature`).
2. Fazer uma chamada qualquer (`generate(...)`).
3. **Esperado**: o fake chat model recebe a chamada (`withStructuredOutput(...).
   invoke(...)`); nenhum client OpenAI é criado ou chamado.

### Cenário 2 — Modo standalone continua idêntico (regressão) (US1)

1. Construir `GroundedGenerator` como em qualquer teste já existente (`client`
   mockado ou `apiKey`, sem `langchainModel`).
2. Fazer uma chamada qualquer.
3. **Esperado**: comportamento idêntico ao existente antes desta feature — nenhuma
   diferença observável.

### Cenário 3 — Resultado com o mesmo formato nos dois modos (US2)

1. Configurar o fake chat model LangChain para retornar uma saída estruturada
   equivalente à usada em um teste existente do modo standalone (mesmos valores de
   `extracted_facts`/`sufficient_context`/`reasoning`/`final_answer` ou equivalente
   por componente).
2. Fazer a mesma chamada nos dois modos (modo standalone com o mock OpenAI existente;
   modo LangChain com o fake configurado).
3. **Esperado**: o resultado retornado (`GroundedCallResult`/
   `GroundedExtractionResult`) tem exatamente o mesmo formato e os mesmos valores nos
   dois modos.

### Cenário 4 — Erros mapeados de forma idêntica nos dois modos (US2)

1. Configurar o fake chat model LangChain para rejeitar a chamada (erro genérico) e,
   em outro teste, para retornar uma saída que não corresponde ao schema esperado.
2. Fazer a chamada em cada caso.
3. **Esperado**: o primeiro caso lança `ModelUnavailableError`; o segundo lança
   `InvalidModelOutputError` — mesmos tipos de erro já lançados pelo modo standalone
   para falhas equivalentes.

### Cenário 5 — Configuração combinando os dois modos é rejeitada (US3)

1. Tentar construir `GroundedGenerator` (ou `GroundedEnricher`/`GroundedExtractor`)
   com `langchainModel` **e** `client` (ou `apiKey`, `model`, ou `temperature`) ao
   mesmo tempo.
2. **Esperado**: o constructor lança um erro de configuração imediatamente,
   explicando que os dois modos são mutuamente exclusivos — a construção não
   completa com sucesso em nenhuma dessas combinações.

### Cenário 6 — Limite de contexto padrão no modo LangChain (edge case)

1. Construir qualquer um dos três componentes com `langchainModel` e sem
   `maxContextTokens`.
2. Fazer uma chamada com um prompt cujo tamanho estimado excede 128.000 tokens.
3. **Esperado**: `ContextTooLargeError` é lançado antes de qualquer chamada ao chat
   model, usando o limite padrão de 128.000 tokens.

### Cenário 7 — Consistência entre os três componentes (FR-011)

1. Construir `GroundedGenerator`, `GroundedEnricher`, e `GroundedExtractor`, cada um
   com o mesmo fake chat model LangChain.
2. Fazer uma chamada em cada um.
3. **Esperado**: em todos os três, a chamada é feita através do chat model fornecido,
   com o mesmo comportamento de exclusividade mútua e mesmo default de contexto.

## Referências

- Regras completas de comportamento observável: `contracts/langchain-model-support.md`.
- Forma dos tipos/abstrações afetados: `data-model.md`.
- Racional das decisões (extração do JSON Schema, formato de mensagens, dependência
  opcional, default de contexto, mapeamento de erros): `research.md`.

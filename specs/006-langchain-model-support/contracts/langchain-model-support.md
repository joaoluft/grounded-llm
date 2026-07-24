# Contract: `langchainModel` em `GroundedCallConfig` (todos os componentes)

**Feature**: 006-langchain-model-support | **Date**: 2026-07-16

Este contrato documenta o comportamento observável introduzido por `langchainModel`
em `GroundedCallConfig`, herdado por `GroundedGenerator`, `GroundedEnricher` e
`GroundedExtractor`.

## Construção

- `langchainModel` (chat model LangChain) — opcional, sem valor default, disponível
  de forma consistente nos três componentes da família (FR-001, FR-011).
- Mutuamente exclusivo com `client`, `apiKey`, `model` e `temperature` (FR-003).
- `maxContextTokens` continua aceito nos dois modos (FR-004, FR-005).
- `identity`, `rules`, `tone`, `fallbackValue` continuam aceitos e inalterados nos
  dois modos (FR-009).

## Regras de comportamento observável (derivadas do spec)

1. **Dispatch de backend**: quando `langchainModel` é fornecido, todas as chamadas de
   modelo deste componente são feitas através dele, nunca através de um client
   OpenAI nativo (FR-002).
2. **Config inválida rejeitada cedo**: se `langchainModel` for fornecido junto com
   `client`, `apiKey`, `model` ou `temperature`, o constructor do componente lança um
   erro de configuração imediatamente — a construção nunca "escolhe" um dos dois
   modos silenciosamente (FR-003, SC-004).
3. **Contexto sem `model` conhecido**: no modo LangChain, se `maxContextTokens` não
   for informado, o limite aplicado é 128.000 tokens; se for informado, o valor
   informado é respeitado, com a mesma checagem de `ContextTooLargeError` já usada no
   modo standalone (FR-004, FR-005).
4. **Formato de resultado idêntico**: para uma resposta de modelo equivalente, o
   resultado retornado (`GroundedCallResult`/`GroundedExtractionResult`) tem
   exatamente o mesmo formato nos dois modos (FR-006, SC-003).
5. **Erros operacionais idênticos**: falha de chamada ao modelo → mesmo
   `ModelUnavailableError` do modo standalone; saída fora do schema esperado → mesmo
   `InvalidModelOutputError` do modo standalone (FR-007, FR-008).
6. **Campos de composição de prompt inalterados**: `identity`, `rules`, `tone` e
   `fallbackValue` continuam funcionando exatamente como hoje em ambos os modos
   (FR-009).
7. **Sem regressão no modo standalone**: quando `langchainModel` não é fornecido, o
   comportamento é idêntico ao existente antes desta feature (FR-010, SC-002).
8. **Zero custo de dependência quando não usado**: um projeto que nunca configura
   `langchainModel` não precisa instalar nenhuma biblioteca relacionada a LangChain
   (FR-012, SC-005).

## Compatibilidade retroativa

Nenhum consumidor que já usa `client`/`apiKey`/`model`/`temperature` hoje observa
qualquer diferença de comportamento — `langchainModel` é estritamente aditivo, e sua
ausência (caso padrão para todo consumidor existente) resulta no mesmo comportamento
de antes desta feature (FR-010).

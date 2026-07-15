# Contract: GroundedGenerator (Public API)

**Feature**: 001-grounded-generator | **Date**: 2026-07-15

Este documento descreve o contrato público do componente, como consumido por um
desenvolvedor da lib. A assinatura exata (TypeScript) é decisão de implementação
(`/speckit-tasks`); aqui descrevemos forma, obrigatoriedade e comportamento observável.

## Construção

Entrada na construção (`GroundedCallConfig`, ver `data-model.md`):

- `fallbackValue` (string) — obrigatório, sem default. Construir sem `fallbackValue`, ou com
  qualquer outro parâmetro obrigatório ausente/malformado (ex.: `model` vazio), MUST falhar
  imediatamente (erro de configuração), antes de qualquer chamada de geração (FR-005).
- `client` (instância do client `openai`) — opcional. Quando fornecida pelo desenvolvedor (por
  exemplo, já configurada com retry, timeout ou `baseURL` customizados), o componente a usa
  diretamente em vez de criar uma nova (FR-008).
- `apiKey` (string) — opcional, usado apenas quando `client` não é fornecido; default lido de
  `OPENAI_API_KEY`.
- `model` (string) — opcional, usado apenas quando `client` não é fornecido; default
  `"gpt-4o-mini"`.
- `temperature` (number) — opcional; default `0`.
- `maxContextTokens` (number) — opcional. Quando omitido, o componente usa um default derivado
  do limite conhecido do `model` configurado.
- `identity` (string) — opcional. Papel/objetivo do modelo nesta chamada. **Adicionado pela
  feature 002** (FR-401), não fazia parte do escopo original desta feature; documentado aqui
  porque este arquivo é o contrato público autoritativo do componente. Ver
  `specs/002-generator-family/spec.md` e `contracts/GroundedEnricher.md`/`GroundedExtractor.md`
  para os detalhes completos.
- `rules` (string) — opcional. Regras adicionais para esta chamada. **Adicionado pela feature
  002** (FR-402), mesma nota acima.

O componente não recebe nem depende de nenhum objeto/tipo de terceiros (ex.: LangChain) — apenas
o client oficial `openai`, usado internamente. Isso permite plugar o `GroundedGenerator` como
um node de função dentro de qualquer pipeline de orquestração (LangGraph, chain manual, chamada
direta), sem exigir que o chamador adapte tipos.

## Operação principal: gerar resposta

**Entrada** (`GenerationRequest`):

- `context` (string, obrigatório)
- `question` (string, obrigatório) — vazia/ausente MUST ser rejeitada imediatamente como uso
  inválido, sem chamar o modelo (distinto de contexto insuficiente)

**Saída em caso de sucesso ou fallback** (`GroundedCallResult`):

- `finalAnswer` (string)
- `usedFallback` (boolean)
- `extractedFacts` (array de string — trechos literais do `context`)
- `reasoning` (string)

**Saída em caso de erro operacional**: rejeição/exceção distinta do `GroundedCallResult`,
identificável programaticamente como uma de:

- Falha técnica na chamada ao modelo (indisponibilidade, timeout, erro de comunicação) — FR-010
- Contexto excede (com margem de segurança) o limite processável do modelo configurado — FR-011
- Resposta do modelo falha a validação do schema de saída estruturada, ou é recusada — FR-012

Essas três categorias de erro operacional MUST ser distinguíveis entre si e do caminho de
fallback (`usedFallback = true`), para que o desenvolvedor consumidor possa tratá-las de forma
diferente (ex.: retry para indisponibilidade, redução de contexto para limite excedido, nenhuma
ação especial para fallback — que já é um resultado válido, não um erro). O componente não
reitenta automaticamente em nenhum desses três casos: a decisão de retry é sempre do
desenvolvedor consumidor.

## Regras de comportamento observável (derivadas do spec)

1. Se `context` estiver vazio/em branco → `usedFallback = true`, `extractedFacts = []`.
2. Se nenhum trecho relevante puder ser extraído do `context` → `usedFallback = true`, mesmo
   que `context` não esteja vazio.
3. Se `usedFallback = false` → todo o conteúdo semântico de `finalAnswer` MUST ser rastreável a
   um ou mais itens de `extractedFacts`.
4. Contradição interna no `context` sobre o mesmo fato → tratado como contexto insuficiente →
   `usedFallback = true` (o componente não tenta resolver a contradição).
5. Chamadas repetidas com o mesmo `context` + `question` MUST produzir resultados consistentes
   (determinístico por padrão — temperature 0).
6. Nenhuma redação/mascaramento é aplicada a `extractedFacts` ou `reasoning` — retornados como
   aparecem no `context` original.
7. O componente não mantém estado entre chamadas (sem histórico de conversa); cada chamada é
   independente, e chamadas concorrentes à mesma instância são seguras (sem estado mutável
   compartilhado).
8. Se `identity`/`rules` forem configurados (feature 002), aparecem nas instruções enviadas ao
   modelo sempre depois das instruções internas de ancoragem — nunca as substituindo.

## Fora de escopo deste contrato

- Streaming de resposta (saída sempre completa, não incremental).
- Cálculo ou exposição de um score de confiança (responsabilidade do `GroundedDecider`).
- Verificação de consistência pós-geração como módulo plugável (`verification/`, feature
  separada).
- Suporte a providers além do ecossistema OpenAI — o client `openai` é o único suportado,
  seja injetado via `client` ou construído internamente a partir de `apiKey`/`model`.

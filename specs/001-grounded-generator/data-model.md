# Data Model: GroundedGenerator

**Feature**: 001-grounded-generator | **Date**: 2026-07-15

Entidades derivadas do spec (`Key Entities`), descritas de forma agnóstica a implementação
(sem assumir a forma exata do tipo TypeScript, que é decisão de `/speckit-tasks`).

## GenerationRequest (Solicitação de Geração)

Representa uma chamada ao componente.

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `context` | string | Sim | Texto já concatenado pelo desenvolvedor; se vazio/em branco, tratado como contexto insuficiente (Edge Case) |
| `question` | string | Sim | Pergunta do usuário final; se vazia/ausente, rejeitada imediatamente como uso inválido, sem chamar o modelo (Edge Case) |

Sem histórico de conversa: cada `GenerationRequest` é independente (decisão de clarificação —
single-turn).

## ExtractedFact (Fato Extraído)

Um trecho literal do `context` identificado como relevante para a pergunta. Representado em
código como um elemento `string` simples dentro do array `extractedFacts` de
`GroundedCallResult` — não um objeto com campo próprio.

| Campo (conceitual) | Tipo | Obrigatório | Regras |
|---|---|---|---|
| (o próprio valor) | string | Sim | Deve ser um trecho literal existente no `context` fornecido — não paráfrase |

Relação: um `GroundedCallResult` contém zero ou mais `ExtractedFact` em `extractedFacts`. Zero
fatos extraídos implica contexto insuficiente (FR-004).

## SufficiencyAssessment (Avaliação de Suficiência)

Decisão explícita e anterior à geração da resposta final. Corresponde ao campo `sufficient_context`
do schema de saída estruturada do modelo (ver `GroundedCallResult` abaixo, onde esse valor é
consumido para derivar `usedFallback`).

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `sufficient_context` | boolean | Sim | `false` quando o contexto/fatos extraídos não sustentam uma resposta segura (inclui contexto vazio, informação parcial insegura, ou contradição interna — ver Edge Cases) |

## GroundedCallResult (Resultado da Geração)

Saída retornada por toda execução bem-sucedida (não confundir com falha técnica/operacional —
ver `OperationalError` abaixo). Nome compartilhado com a futura classe base `GroundedCall`
(reaproveitável pelo `GroundedDecider`), especializado nesta feature com os campos abaixo. Os
campos de `GroundedCallResult` são derivados do schema de saída estruturada do modelo
(`extracted_facts`, `sufficient_context`, `reasoning`, `final_answer` — nomes usados na chamada
`zodResponseFormat`, ver plan.md/research.md), mapeados para os nomes idiomáticos abaixo.

| Campo | Tipo | Obrigatório | Derivado de (schema) | Regras |
|---|---|---|---|---|
| `finalAnswer` | string | Sim | `final_answer` | Resposta final ao usuário, ou o valor de `fallbackValue` configurado quando `usedFallback = true` |
| `usedFallback` | boolean | Sim | `sufficient_context` (invertido) | `true` quando `sufficient_context = false` (ou nenhum fato relevante extraído) |
| `extractedFacts` | string[] | Sim (pode ser vazio) | `extracted_facts` | Fatos (`ExtractedFact`) que sustentam `finalAnswer`; vazio quando `usedFallback = true` sem fatos parciais encontrados |
| `reasoning` | string | Sim | `reasoning` | Raciocínio que conecta os fatos extraídos à resposta final; presente mesmo em caso de fallback, explicando por que o contexto foi considerado insuficiente |

Invariante: se `usedFallback = false`, então `finalAnswer` MUST derivar exclusivamente de
`extractedFacts` (FR-003) — verificado por teste de comportamento, não por validação em tempo
de execução (constitution não exige checagem de consistência nesta feature; isso é módulo
`verification/`, fora de escopo).

## GroundedCallConfig (Configuração do Componente)

Definida no momento da construção do `GroundedGenerator` (via `core/GroundedCall.ts`).

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| `client` | instância do client `openai` | Não | Quando fornecida, usada diretamente (permite retry/timeout/baseURL customizados pelo desenvolvedor); quando omitida, o componente cria uma internamente a partir de `apiKey`/`model` (FR-008) |
| `apiKey` | string | Não | Usado apenas quando `client` não é fornecido; default: lido de `OPENAI_API_KEY` |
| `model` | string | Não | Usado apenas quando `client` não é fornecido; default: `"gpt-4o-mini"` |
| `fallbackValue` | string | Sim | Sem default implícito; construção falha se ausente (FR-005) |
| `temperature` | number | Não | Default: `0` (princípio 6 da constitution) |
| `maxContextTokens` | number | Não | Default derivado do limite conhecido do `model`, quando disponível; usado para o gate de `OperationalError` (FR-011) |
| `identity` | string | Não | **Adicionado pela feature 002** (FR-401) — papel/objetivo do modelo nesta chamada; anexado após as instruções internas de ancoragem |
| `rules` | string | Não | **Adicionado pela feature 002** (FR-402) — regras adicionais para esta chamada; anexado depois de `identity`, sempre após as instruções internas |

## OperationalError (Erro Operacional)

Não é uma entidade de dado retornada como resultado — é uma falha sinalizada distintamente do
`GroundedCallResult`, cobrindo três cenários do spec (FR-010, FR-011, FR-012):

| Tipo | Causa |
|---|---|
| `ModelUnavailableError` (ou equivalente) | Falha técnica na chamada ao modelo (indisponibilidade, timeout, erro de comunicação) — FR-010 |
| `ContextTooLargeError` (ou equivalente) | Contexto fornecido excede (com margem de segurança) o limite processável estimado do modelo configurado — FR-011 |
| `InvalidModelOutputError` (ou equivalente) | A resposta do modelo falha a validação do schema de saída estruturada, ou é recusada pelo modelo — FR-012 |

Todos os três são distintos de `usedFallback = true`: fallback é uma decisão de negócio
(contexto insuficiente), enquanto `OperationalError` é uma falha técnica/operacional que impede
a execução de completar. Nenhum dos três tipos aciona retry automático — o componente não
reitenta por conta própria (ver Assumptions do spec); a decisão de retry é do desenvolvedor
consumidor.

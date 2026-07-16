# Feature Specification: fallbackValue opcional na família de generators

**Feature Branch**: `003-optional-fallback`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Make fallbackValue optional across GroundedGenerator, GroundedEnricher, and GroundedExtractor. Today fallbackValue is mandatory on construction for all three. GroundedGenerator isn't only used for strict grounded Q&A — it's also used for general-purpose generation where a canned fallback string is the wrong tool, and the caller may prefer the model to still produce a real, best-effort answer instead of a fixed message. Behavior by component when fallbackValue is NOT configured: (1) GroundedGenerator — when the model judges context insufficient (or context is empty/blank), it must still call the model and return its own best-effort answer (general knowledge, or a clarifying question back to the user) instead of a canned fallback string; usedFallback is always false in this case. When fallbackValue IS configured, behavior is unchanged from today (returns fallbackValue, usedFallback true, short-circuits on empty context without calling the model). (2) GroundedEnricher — no functional change either way; it already returns baseContent unchanged on insufficient context rather than fallbackValue, so this is a type-level-only change. (3) GroundedExtractor — when fallbackValue is NOT configured, `strict` is ignored (always treated as false) and both the 'nothing extracted' and 'partial extraction' cases return the extracted data as produced by the model (null for missing fields), never throwing and never substituting a fallback object; usedFallback always false. When fallbackValue IS configured, behavior is unchanged from today. This must be fully backward compatible: every existing caller that already configures fallbackValue keeps identical behavior."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar uma resposta mesmo sem contexto suficiente, sem configurar um fallback fixo (Priority: P1)

Um desenvolvedor usa o `GroundedGenerator` não só para responder perguntas ancoradas em contexto recuperado, mas também para geração de texto mais geral, onde nem sempre existe uma "mensagem de desculpa" fixa que faça sentido retornar. Hoje ele é obrigado a configurar um `fallbackValue` mesmo quando não quer esse comportamento — ele prefere que, quando o contexto for insuficiente, o componente ainda assim chame o modelo e devolva uma resposta real (por exemplo, usando conhecimento geral ou pedindo mais informação ao usuário), em vez de um texto fixo e desconectado da pergunta.

**Why this priority**: É a mudança de comportamento central pedida — sem ela, o `GroundedGenerator` continua inutilizável para os cenários de geração mais livre que motivaram a mudança.

**Independent Test**: Pode ser testado configurando o `GroundedGenerator` sem `fallbackValue`, enviando uma pergunta com contexto insuficiente (ou vazio) e verificando que o componente ainda chama o modelo e retorna a resposta gerada por ele, marcando `usedFallback` como falso.

**Acceptance Scenarios**:

1. **Given** um `GroundedGenerator` configurado sem `fallbackValue`, **When** o contexto fornecido é insuficiente para responder com segurança, **Then** o componente ainda chama o modelo e retorna a resposta gerada por ele (em vez de um texto fixo), com `usedFallback` igual a falso.
2. **Given** um `GroundedGenerator` configurado sem `fallbackValue`, **When** o contexto fornecido está vazio ou em branco, **Then** o componente chama o modelo mesmo assim (em vez de retornar imediatamente sem chamá-lo) e retorna a resposta gerada por ele.
3. **Given** um `GroundedGenerator` configurado sem `fallbackValue`, **When** o contexto é suficiente para responder com segurança, **Then** o comportamento é o mesmo de hoje: o componente retorna a resposta ancorada no contexto, com `usedFallback` igual a falso.

---

### User Story 2 - Manter o comportamento atual para quem já configura fallbackValue (Priority: P1)

Um desenvolvedor que já usa `GroundedGenerator`, `GroundedEnricher` ou `GroundedExtractor` hoje, configurando `fallbackValue`, não quer que essa mudança altere o comportamento observável da sua integração existente.

**Why this priority**: Sem essa garantia, a mudança quebraria todo consumidor atual da biblioteca — é tão crítica quanto a capacidade nova em si.

**Independent Test**: Pode ser testado rodando o conjunto de testes já existente de cada componente (com `fallbackValue` configurado) e confirmando que nenhum caso passa a se comportar de forma diferente do esperado.

**Acceptance Scenarios**:

1. **Given** um `GroundedGenerator` configurado com `fallbackValue`, **When** o contexto é insuficiente ou vazio/em branco, **Then** o comportamento é idêntico ao atual: retorna o `fallbackValue` configurado, com `usedFallback` igual a verdadeiro, sem chamar o modelo no caso de contexto vazio/em branco.
2. **Given** um `GroundedEnricher` configurado com ou sem `fallbackValue`, **When** o contexto é insuficiente para enriquecer com segurança, **Then** o comportamento é idêntico ao atual em ambos os casos: retorna o texto-base inalterado, com `usedFallback` igual a verdadeiro.
3. **Given** um `GroundedExtractor` configurado com `fallbackValue`, **When** nada é extraível da mensagem, ou quando o modo estrito está ativo e algum campo está ausente, **Then** o comportamento é idêntico ao atual: retorna o objeto de fallback completo, com `usedFallback` igual a verdadeiro.

---

### User Story 3 - Extrair dados estruturados sem um objeto de fallback fixo (Priority: P2)

Um desenvolvedor que usa `GroundedExtractor` para extrair campos estruturados da mensagem do usuário prefere, em alguns fluxos, receber sempre os dados brutos extraídos pelo modelo (com `null` nos campos ausentes) em vez de um objeto de fallback fixo — mesmo quando nada foi extraído, ou quando parte dos campos está ausente e o modo estrito estaria ativo.

**Why this priority**: É o mesmo princípio da User Story 1 aplicado ao `GroundedExtractor`, mas afeta um componente e um fluxo de uso mais específicos (extração estruturada), por isso prioridade um degrau abaixo.

**Independent Test**: Pode ser testado configurando o `GroundedExtractor` sem `fallbackValue` (com e sem `strict: true`), enviando mensagens que não preenchem nenhum campo ou preenchem apenas parte deles, e verificando que o componente sempre retorna os dados extraídos com `null` nos campos ausentes, nunca lançando erro nem substituindo por um objeto fixo.

**Acceptance Scenarios**:

1. **Given** um `GroundedExtractor` configurado sem `fallbackValue`, **When** nenhum campo é extraível da mensagem, **Then** o componente retorna um objeto com todos os campos em `null`, com `usedFallback` igual a falso, em vez de lançar erro.
2. **Given** um `GroundedExtractor` configurado sem `fallbackValue` e com `strict: true`, **When** apenas parte dos campos é extraível da mensagem, **Then** o componente ignora o modo estrito e retorna os campos extraídos com `null` nos demais, com `usedFallback` igual a falso.

---

### Edge Cases

- O que acontece quando `context` está vazio/em branco no `GroundedGenerator` sem `fallbackValue` configurado? O modelo é chamado mesmo assim (ver User Story 1, cenário 2) — diferente do caso com fallback configurado, que continua curto-circuitando sem chamar o modelo.
- O que acontece quando `message` está vazia/em branco no `GroundedExtractor` sem `fallbackValue` configurado? O componente retorna diretamente um objeto com todos os campos em `null`, sem chamar o modelo (não há nada a extrair de uma mensagem vazia, com ou sem fallback configurado).
- O que acontece se o desenvolvedor passar uma string vazia como `fallbackValue` (em vez de omiti-lo)? Isso continua sendo tratado como configuração inválida e lança erro imediatamente na construção, exatamente como hoje — omitir o campo é diferente de fornecê-lo vazio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir construir `GroundedGenerator`, `GroundedEnricher` e `GroundedExtractor` sem fornecer `fallbackValue`.
- **FR-002**: O sistema DEVE continuar rejeitando `fallbackValue` explicitamente vazio (string vazia) na construção, com ou sem essa mudança, para qualquer um dos três componentes.
- **FR-003**: Quando `fallbackValue` não for configurado no `GroundedGenerator` e o contexto for julgado insuficiente para responder com segurança, o sistema DEVE ainda assim chamar o modelo e retornar a resposta gerada por ele como resultado final, em vez de um valor fixo.
- **FR-004**: Quando `fallbackValue` não for configurado no `GroundedGenerator` e o contexto fornecido estiver vazio ou em branco, o sistema DEVE chamar o modelo mesmo assim (em vez de curto-circuitar sem chamá-lo), permitindo que ele produza uma resposta.
- **FR-005**: O `GroundedGenerator` DEVE continuar reportando de forma verdadeira, em qualquer um dos dois modos (com ou sem `fallbackValue`), se o contexto foi julgado suficiente e quais trechos foram extraídos, mesmo quando o resultado final não é bloqueado por essa avaliação.
- **FR-006**: O campo que indica uso de fallback (`usedFallback`) DEVE ser sempre falso quando `fallbackValue` não estiver configurado, para qualquer um dos três componentes, já que não existe fallback para ser efetivamente usado.
- **FR-007**: Quando `fallbackValue` estiver configurado no `GroundedGenerator`, o comportamento observável DEVE permanecer idêntico ao atual: contexto insuficiente ou vazio/em branco resulta no `fallbackValue` configurado, com `usedFallback` verdadeiro, e o caso de contexto vazio/em branco continua sem chamar o modelo.
- **FR-008**: O comportamento do `GroundedEnricher` DEVE permanecer idêntico ao atual independentemente de `fallbackValue` estar configurado ou não — contexto insuficiente sempre resulta no texto-base original, com `usedFallback` verdadeiro.
- **FR-009**: Quando `fallbackValue` não for configurado no `GroundedExtractor`, o sistema DEVE ignorar a configuração de `strict` (tratando-a sempre como desativada) e retornar os dados extraídos pelo modelo, com `null` nos campos não encontrados, tanto no caso de nenhum campo extraível quanto no caso de extração parcial.
- **FR-010**: Quando `fallbackValue` estiver configurado no `GroundedExtractor`, o comportamento observável DEVE permanecer idêntico ao atual: nenhum campo extraível, ou extração parcial com `strict: true`, resulta no objeto de fallback completo, com `usedFallback` verdadeiro.
- **FR-011**: Quando `message` estiver vazia ou em branco no `GroundedExtractor` sem `fallbackValue` configurado, o sistema DEVE retornar diretamente um objeto com todos os campos em `null`, sem chamar o modelo.
- **FR-012**: A mudança DEVE ser totalmente compatível com versões anteriores — nenhum consumidor que já configura `fallbackValue` hoje deve observar qualquer diferença de comportamento após a mudança.

### Key Entities *(include if feature involves data)*

- **Resultado de chamada ancorada (`GroundedCallResult`)**: representa o desfecho de uma chamada do `GroundedGenerator` ou `GroundedEnricher` — inclui a resposta final, se um fallback foi usado, os trechos extraídos e o raciocínio. Não muda de formato, apenas os valores possíveis de `usedFallback` e a origem da resposta final quando não há fallback configurado.
- **Resultado de extração (`GroundedExtractionResult`)**: representa o desfecho de uma chamada do `GroundedExtractor` — dados extraídos (por campo, possivelmente `null`), se um fallback foi usado e o raciocínio. Mesma observação: formato inalterado, apenas os valores possíveis mudam conforme `fallbackValue` está ou não configurado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes automatizados existentes para `GroundedGenerator`, `GroundedEnricher` e `GroundedExtractor` (cenários com `fallbackValue` configurado) continuam passando sem alteração após a mudança.
- **SC-002**: Um desenvolvedor consegue construir qualquer um dos três componentes sem fornecer `fallbackValue` e obter um resultado utilizável (resposta real, texto enriquecido ou dados extraídos) em 100% das chamadas, nunca um erro de configuração por ausência desse campo.
- **SC-003**: Em cenários de contexto insuficiente ou vazio sem `fallbackValue` configurado, o `GroundedGenerator` produz uma resposta do modelo (não vazia) em 100% dos casos, nunca deixando o campo de resposta final em branco.

## Assumptions

- Este é um ajuste de comportamento sobre a família de componentes já existente (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) descrita em `specs/002-generator-family`, não uma nova capacidade isolada.
- Nenhum novo parâmetro de configuração é necessário — o comportamento é determinado inteiramente pela presença ou ausência de `fallbackValue`.
- O formato/schema da saída estruturada de cada componente permanece o mesmo; apenas a interpretação do resultado (e as instruções dadas ao modelo) mudam conforme `fallbackValue` está ou não configurado.
- Consumidores que hoje configuram `fallbackValue` em qualquer um dos três componentes não precisam fazer nenhuma alteração no próprio código para manter o comportamento atual.

# Feature Specification: Campo opcional de comportamento/tom para a família de generators

**Feature Branch**: `004-behavioral-tone-field`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Adicionar um novo campo opcional chamado `comportamento` (string) na configuração de todos os componentes da família de generators (GroundedGenerator, GroundedEnricher, GroundedExtractor), permitindo que o desenvolvedor configure como aquela chamada específica da LLM deve se comportar em termos de tom/personalidade — por exemplo: empática, gentil, natural, e outras características desse tipo, úteis especialmente em cenários de chatbot. Esse campo deve ser incorporado ao system prompt enviado ao modelo, sempre depois das instruções internas de ancoragem/anti-alucinação do componente (mesmo padrão já usado pelos campos opcionais `identity` e `rules` existentes, via `buildSystemPrompt`), nunca sobrescrevendo essas instruções. Deve ser opcional, sem valor default, e disponível nos três componentes de forma consistente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar o tom/personalidade da LLM para um cenário de chatbot (Priority: P1)

Um desenvolvedor está construindo um chatbot de atendimento e quer que as respostas do `GroundedGenerator` soem empáticas, gentis e naturais — em vez do tom neutro/genérico que o componente usa hoje — sem precisar reescrever manualmente as instruções internas de ancoragem do componente e sem arriscar enfraquecer as regras de anti-alucinação já embutidas.

**Why this priority**: É o cenário de uso principal que motivou o pedido — tom/personalidade é um requisito muito comum em chatbots comerciais, e hoje não há um lugar dedicado e claramente nomeado para essa configuração.

**Independent Test**: Pode ser testado configurando o `GroundedGenerator` com uma descrição de tom (ex.: "seja empático e gentil") e verificando que essa descrição aparece no system prompt enviado ao modelo, sempre depois das instruções internas de ancoragem do componente.

**Acceptance Scenarios**:

1. **Given** um `GroundedGenerator` configurado com uma descrição de tom/comportamento, **When** o componente monta o system prompt para uma chamada, **Then** a descrição de tom aparece nas instruções enviadas ao modelo, posicionada depois das instruções internas de ancoragem/anti-alucinação.
2. **Given** um `GroundedGenerator` configurado sem essa descrição de tom, **When** o componente monta o system prompt, **Then** nenhuma seção adicional de tom é incluída — comportamento idêntico ao atual.

---

### User Story 2 - Usar a mesma configuração de tom em qualquer componente da família (Priority: P2)

Um desenvolvedor que já usa mais de um componente da família (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) na mesma aplicação quer configurar o mesmo tom de forma consistente em todos eles, sem precisar aprender uma convenção diferente por componente.

**Why this priority**: Reforça a usabilidade da família como um todo, mas é um refinamento sobre a capacidade central (US1), que já entrega valor sozinha com o `GroundedGenerator`.

**Independent Test**: Pode ser testado configurando o mesmo texto de tom em cada um dos três componentes e verificando que, em todos eles, o texto aparece no system prompt enviado ao modelo, seguindo a mesma posição relativa às instruções internas.

**Acceptance Scenarios**:

1. **Given** qualquer um dos três componentes configurado com uma descrição de tom, **When** o componente monta o system prompt para uma chamada, **Then** a descrição aparece nas instruções enviadas ao modelo, depois das instruções internas daquele componente especificamente.

---

### Edge Cases

- O que acontece se o desenvolvedor configurar a descrição de tom como uma string vazia ou só espaços? Tratado como "não configurado" — nenhuma seção adicional é incluída no prompt (mesmo comportamento hoje adotado por `identity`/`rules`, que só são anexados quando teem conteúdo).
- O que acontece se `identity`, `rules` e a nova descrição de tom forem todos configurados juntos? Todos são incluídos, cada um em sua própria seção, na mesma ordem relativa entre si definida para esta funcionalidade (ver Clarifications).
- O `GroundedExtractor` não produz texto de resposta conversacional (apenas dados estruturados) — a descrição de tom ainda é aceita e incluída no prompt por consistência entre os três componentes, mesmo que seu efeito prático sobre a saída seja mais limitado nesse componente.

## Clarifications

### Session 2026-07-16

- Q: Como o novo campo deve se chamar na API pública, já que os campos existentes (`identity`, `rules`) usam nomes em inglês? → A: `tone`
- Q: Quando `identity`, `rules` e o novo campo são configurados juntos, em que ordem relativa eles devem aparecer no system prompt? → A: identity → rules → tone (tom por último, mais próximo da resposta)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE aceitar, na construção de `GroundedGenerator`, `GroundedEnricher` e `GroundedExtractor`, um novo parâmetro opcional `tone` (string), sem valor default.
- **FR-002**: Quando `tone` for configurado com um valor não vazio, o sistema DEVE incluí-lo como uma seção adicional no system prompt enviado ao modelo, sempre depois das instruções internas de ancoragem/anti-alucinação daquele componente.
- **FR-003**: Quando `identity`, `rules` e/ou `tone` forem configurados juntos, o sistema DEVE compô-los no system prompt na ordem: instruções internas → `identity` → `rules` → `tone`.
- **FR-004**: O conteúdo de `tone` NUNCA DEVE sobrescrever, contradizer instrução alguma, ou substituir as instruções internas de ancoragem/anti-alucinação do componente — ele apenas complementa o estilo da resposta.
- **FR-005**: Quando `tone` não for configurado, ou for uma string vazia/em branco, o sistema DEVE se comportar exatamente como hoje — nenhuma seção adicional relacionada a tom é incluída no prompt.
- **FR-006**: O comportamento de `tone` DEVE ser consistente entre os três componentes — mesma posição relativa no prompt, mesma regra de "vazio = não incluído", em todos eles.
- **FR-007**: A mudança DEVE ser totalmente compatível com versões anteriores — nenhum consumidor que já configura `identity`/`rules` hoje deve observar qualquer diferença de comportamento nessas seções.

### Key Entities *(include if feature involves data)*

- **Configuração de tom/comportamento (`tone`)**: texto livre fornecido pelo desenvolvedor na construção de qualquer componente da família, descrevendo o estilo/personalidade desejado da resposta (ex.: "seja empático, gentil e natural"). Reaproveita a mesma mecânica de composição de prompt já usada por `identity`/`rules`, sem introduzir um novo tipo de dado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um desenvolvedor consegue configurar `tone` em qualquer um dos três componentes e observar seu conteúdo refletido no system prompt enviado ao modelo em 100% das chamadas em que `tone` está configurado.
- **SC-002**: 100% dos testes automatizados existentes para os três componentes (sem `tone` configurado) continuam passando sem alteração após a mudança.
- **SC-003**: Quando `identity`, `rules` e `tone` são configurados juntos, a ordem relativa das três seções no prompt enviado ao modelo é a mesma (identity → rules → tone) em 100% das chamadas, em qualquer um dos três componentes.

## Assumptions

- Este é um ajuste aditivo sobre a família de componentes já existente (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`), reaproveitando o mecanismo de composição de prompt (`buildSystemPrompt`) já introduzido para `identity`/`rules` na feature `002-generator-family`.
- Nenhuma validação de conteúdo é aplicada ao texto de `tone` (é texto livre, como `identity`/`rules`) — não há lista fechada de tons permitidos.
- `tone` não tem efeito sobre a lógica de extração/suficiência/fallback de nenhum componente — afeta apenas o estilo da resposta gerada pelo modelo.

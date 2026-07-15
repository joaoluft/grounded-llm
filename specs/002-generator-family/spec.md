# Feature Specification: Família de Generators (ajuste + GroundedEnricher + GroundedExtractor)

**Feature Branch**: `002-generator-family`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Ajustar o GroundedGenerator existente e adicionar dois novos componentes à lib grounded-llm, formando uma família de três generators para diferentes cenários de chamada LLM ancorada em contexto: (1) melhorar as descrições dos campos do schema de saída do GroundedGenerator; (2) GroundedEnricher, para enriquecer um texto/resposta existente com contexto recuperado; (3) GroundedExtractor, para extrair um objeto estruturado com chaves definidas pelo desenvolvedor a partir da mensagem do usuário."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enriquecer uma resposta existente com contexto recuperado (Priority: P1)

Um desenvolvedor backend já possui um texto ou resposta-base (por exemplo, uma mensagem template, ou o rascunho de uma resposta) e quer enriquecê-lo com informação adicional vinda de contexto recuperado (via RAG ou outra fonte), sem reescrever a resposta do zero e sem que o componente invente informação que não esteja no contexto fornecido.

**Why this priority**: É um cenário de uso tão comum quanto a geração de resposta final (chatbots que combinam uma resposta-base com dados dinâmicos recuperados), e hoje a lib não oferece nenhum componente para isso — o desenvolvedor teria que implementar a lógica de ancoragem por conta própria.

**Independent Test**: Pode ser testado fornecendo um texto-base e um contexto que contém informação relevante para enriquecê-lo, e verificando que o texto enriquecido incorpora apenas informação rastreável ao contexto fornecido, mantendo o conteúdo original a menos que o contexto o contradiga de forma segura.

**Acceptance Scenarios**:

1. **Given** um texto-base e um contexto que contém informação relevante e adicional a esse texto, **When** o componente processa a solicitação de enriquecimento, **Then** ele retorna um texto enriquecido que incorpora essa informação adicional, rastreável a trechos extraídos do contexto.
2. **Given** um texto-base e um contexto sem informação relevante para adicionar, **When** o componente avalia a suficiência do contexto para enriquecimento, **Then** ele aciona o comportamento de fallback configurado, sem inventar enriquecimento a partir de conhecimento externo.

---

### User Story 2 - Extrair dados estruturados definidos pelo desenvolvedor a partir da mensagem do usuário (Priority: P1)

Um desenvolvedor backend quer extrair informações estruturadas (por exemplo, nome, e-mail, intenção, ou qualquer outro conjunto de campos que ele mesmo define) a partir da mensagem de um usuário final, para uso em fluxos de chatbot comercial (triagem, cadastro, roteamento), sem que o componente invente valores para campos que não estejam presentes ou não possam ser inferidos com segurança da mensagem.

**Why this priority**: Extração de dados estruturados da entrada do usuário é um dos usos mais comuns de "JSON mode" em chatbots comerciais hoje, e sofre do mesmo risco de alucinação (o modelo preenche campos com valores inventados) que os outros componentes da lib já resolvem para geração de texto.

**Independent Test**: Pode ser testado fornecendo um schema de campos definido pelo desenvolvedor e uma mensagem de usuário que contém informação para preencher parte ou todos os campos, verificando que os valores extraídos são rastreáveis à mensagem fornecida, e que campos não inferíveis com segurança não são inventados.

**Acceptance Scenarios**:

1. **Given** um schema de campos definido pelo desenvolvedor e uma mensagem do usuário que contém informação suficiente para preencher esses campos com segurança, **When** o componente processa a mensagem, **Then** ele retorna os valores extraídos, rastreáveis ao texto da mensagem.
2. **Given** um schema de campos definido pelo desenvolvedor e uma mensagem do usuário que não contém informação suficiente para preencher nenhum campo com segurança, **When** o componente avalia a mensagem, **Then** ele aciona o fallback configurado (objeto completo), em vez de inventar valores.
3. **Given** o componente configurado em modo não-estrito (default) e uma mensagem que preenche apenas parte dos campos com segurança, **When** o componente processa a mensagem, **Then** ele retorna os campos extraíveis e marca os demais como ausentes, sem acionar o fallback do objeto inteiro.
4. **Given** o componente configurado em modo estrito e uma mensagem que preenche apenas parte dos campos com segurança, **When** o componente processa a mensagem, **Then** ele aciona o fallback do objeto completo, mesmo que alguns campos fossem extraíveis.

---

### User Story 3 - Melhorar a qualidade da decisão de suficiência do GroundedGenerator existente (Priority: P3)

Um desenvolvedor que já usa o `GroundedGenerator` se beneficia de uma melhoria na forma como o componente comunica ao modelo o propósito de cada campo da saída estruturada (o que é um "fato extraído," o que significa "contexto suficiente," etc.), reduzindo a chance de decisões de suficiência mal calibradas.

**Why this priority**: É um refinamento de qualidade sobre uma funcionalidade já existente e validada, não uma nova capacidade — de menor prioridade que as duas novas capacidades acima, mas de baixo risco e rápido de entregar.

**Independent Test**: Pode ser testado comparando o comportamento observável do `GroundedGenerator` antes e depois do ajuste com o mesmo conjunto de casos de teste já existente (contexto suficiente, insuficiente, contraditório) e confirmando que nenhum caso passa a se comportar de forma diferente do esperado (não há regressão).

**Acceptance Scenarios**:

1. **Given** o conjunto de testes já existente do `GroundedGenerator` (contexto suficiente, insuficiente, vazio, contraditório), **When** o ajuste é aplicado, **Then** todos os casos continuam se comportando exatamente como antes (nenhuma regressão de comportamento).

---

### Edge Cases

- O que acontece quando o texto-base fornecido ao `GroundedEnricher` está vazio? O componente deve tratar isso como uma solicitação inválida (não há o que enriquecer), distinta de contexto insuficiente — rejeitado imediatamente, sem envolver `fallbackValue` (FR-110).
- O que acontece quando o contexto fornecido ao `GroundedEnricher` está vazio ou em branco? Tratado como insuficiente para enriquecimento — o texto-base é retornado inalterado (FR-106), não o `fallbackValue`. O que acontece quando a mensagem do usuário fornecida ao `GroundedExtractor` está vazia ou em branco? Tratado como informação insuficiente para qualquer campo — aciona o `fallbackValue` (objeto completo, FR-206), mesmo comportamento equivalente ao contexto vazio já estabelecido para o `GroundedGenerator`.
- O que acontece quando o desenvolvedor não configura um valor de fallback para o `GroundedEnricher` ou `GroundedExtractor`? Não é permitido: fallback explícito é obrigatório na configuração de ambos os componentes, assim como no `GroundedGenerator`.
- O que acontece quando a mensagem do usuário fornecida ao `GroundedExtractor` contém informação parcial (preenche alguns campos do schema definido pelo desenvolvedor, mas não todos)? Por padrão (modo não-estrito), o componente retorna os campos extraíveis e marca os demais como ausentes/nulos, sem acionar o fallback do objeto inteiro. Se o desenvolvedor configurar o modo estrito (FR-211), qualquer campo ausente aciona o `fallbackValue` do objeto completo.

## Requirements *(mandatory)*

### Functional Requirements

#### GroundedEnricher (novo)

- **FR-101**: O componente MUST aceitar um texto-base a ser enriquecido e um contexto recuperado como entradas.
- **FR-102**: O componente MUST extrair, a partir do contexto fornecido, os trechos literais relevantes para enriquecer o texto-base, antes de gerar o texto enriquecido.
- **FR-103**: O componente MUST determinar explicitamente se o contexto fornecido é suficiente para enriquecer o texto-base com segurança, como uma decisão observável no resultado.
- **FR-104**: O texto enriquecido gerado MUST derivar apenas do texto-base original combinado com os trechos extraídos do contexto, sem incorporar informação externa a essas duas fontes.
- **FR-105**: O componente MUST exigir um valor de fallback configurado explicitamente no momento da construção; a ausência de fallback impede o uso do componente. Nota: para o `GroundedEnricher`, esse valor não é retornado em nenhum fluxo de sucesso definido nesta feature (ver FR-106, FR-110) — é exigido por consistência de API com os demais componentes da família (`GroundedGenerator`, `GroundedExtractor`) e como reserva para cenários futuros, não porque exista hoje um caminho de código que o invoque.
- **FR-106**: Quando o contexto for insuficiente para enriquecer com segurança (incluindo contexto vazio/em branco), o componente MUST retornar o texto-base original sem modificação (nenhum enriquecimento aplicado), sinalizando isso explicitamente no resultado (`usedFallback = true`, `finalAnswer = baseContent`). Um `baseContent` vazio/em branco NÃO é esse caso — é uso inválido, tratado por FR-110 (rejeição imediata), não por este requisito.
- **FR-107**: O resultado retornado pelo componente MUST incluir, em toda execução bem-sucedida: o texto enriquecido ou o texto-base original inalterado (conforme FR-106), indicação explícita de uso de fallback/não-enriquecimento, os trechos extraídos que sustentam o enriquecimento (quando houver), e o raciocínio conectando os trechos ao enriquecimento.
- **FR-110**: O componente MUST rejeitar imediatamente, com um erro de uso inválido (antes de qualquer chamada ao modelo), um `baseContent` vazio ou em branco — distinto do fluxo de fallback de FR-106 e sem envolver o `fallbackValue` configurado.
- **FR-108**: O componente MUST operar de forma determinística por padrão.
- **FR-109**: O componente MUST sinalizar de forma distinta uma falha técnica na chamada ao modelo de uma decisão de fallback por contexto insuficiente.

#### GroundedExtractor (novo)

- **FR-201**: O componente MUST aceitar, no momento da construção, uma definição de campos fornecida pelo desenvolvedor descrevendo quais informações devem ser extraídas da mensagem do usuário.
- **FR-202**: O componente MUST aceitar uma mensagem do usuário final como entrada para extração.
- **FR-203**: O componente MUST extrair valores apenas para os campos definidos pelo desenvolvedor, derivados exclusivamente do conteúdo da mensagem fornecida, sem inventar valores não suportados pelo texto.
- **FR-204**: O componente MUST determinar explicitamente se a mensagem fornece informação suficiente para uma extração segura, como uma decisão observável no resultado.
- **FR-205**: O componente MUST exigir um valor de fallback configurado explicitamente no momento da construção (um objeto completo, no mesmo formato da definição de campos); a ausência de fallback impede o uso do componente.
- **FR-206**: O componente MUST retornar o `fallbackValue` (objeto completo) quando a mensagem, como um todo, não fornecer informação suficiente para extrair nenhum campo com segurança. Quando apenas parte dos campos for extraível com segurança (extração parcial — ver FR-211/Edge Cases), os campos não extraíveis individualmente MUST ser marcados como ausentes/nulos no resultado, sem substituir o objeto inteiro pelo `fallbackValue`.
- **FR-207**: O resultado retornado pelo componente MUST incluir, em toda execução: os valores extraídos (completos, parciais com campos ausentes, ou o `fallbackValue`, conforme FR-206), indicação explícita de uso de fallback, e o raciocínio conectando o texto da mensagem aos valores extraídos.
- **FR-208**: O componente MUST operar de forma determinística por padrão.
- **FR-209**: O componente MUST sinalizar de forma distinta uma falha técnica na chamada ao modelo de uma decisão de fallback por informação insuficiente.
- **FR-210**: O componente NÃO MUST exigir um conjunto fechado de ações válidas nem cálculo de confiança via logprob — esses requisitos pertencem exclusivamente ao futuro `GroundedDecider`, fora do escopo desta feature.
- **FR-211**: O componente MUST aceitar uma configuração explícita (booleana, default `false`) que determina se extração parcial é aceita: quando `false` (padrão), o comportamento de FR-206/FR-212 se aplica (campos extraíveis são retornados, mesmo que outros estejam ausentes); quando `true` ("modo estrito"), a extração só é considerada bem-sucedida se **todos** os campos definidos puderem ser extraídos com segurança — caso contrário, o `fallbackValue` (objeto completo) é retornado no lugar de um resultado parcial.
- **FR-212**: Em modo não-estrito (default), a presença de um ou mais campos ausentes/nulos no resultado NÃO MUST, por si só, acionar o `fallbackValue` do objeto inteiro — o fallback do objeto completo é reservado para quando nenhum campo pôde ser extraído com segurança (FR-206) ou quando o modo estrito (FR-211) está ativo e a extração não foi completa.

#### GroundedGenerator (ajuste)

- **FR-301**: Cada campo da saída estruturada do `GroundedGenerator` (fatos extraídos, decisão de suficiência, raciocínio, resposta final) MUST incluir uma descrição explícita, legível pelo modelo, do seu propósito — em particular, a decisão de suficiência MUST ser descrita como "se o contexto fornecido é suficiente para responder com segurança, sem completar com conhecimento externo."
- **FR-302**: Este ajuste MUST preservar integralmente o comportamento observável já validado do `GroundedGenerator` (FR-001 a FR-012 da feature 001) — nenhuma regressão é permitida.

### Key Entities

- **Solicitação de Enriquecimento**: Representa uma chamada ao `GroundedEnricher`, contendo o texto-base a enriquecer e o contexto recuperado.
- **Resultado de Enriquecimento**: Saída do `GroundedEnricher`, contendo o texto enriquecido (ou fallback), indicação de uso de fallback, trechos extraídos, e raciocínio.
- **Definição de Campos de Extração**: Conjunto de campos definidos pelo desenvolvedor no momento da construção do `GroundedExtractor`, descrevendo o que deve ser extraído da mensagem do usuário.
- **Configuração do Componente (GroundedExtractor)**: Inclui, além do fallback obrigatório (objeto completo) e da definição de campos, um modo estrito (booleano, default `false`) que determina se extração parcial é aceita ou se todos os campos precisam ser extraídos com segurança para o resultado não cair no fallback.
- **Solicitação de Extração**: Representa uma chamada ao `GroundedExtractor`, contendo a mensagem do usuário a ser processada.
- **Resultado de Extração**: Saída do `GroundedExtractor`, contendo os valores extraídos (completos, parciais com campos ausentes, ou o fallback do objeto inteiro), indicação de uso de fallback, e raciocínio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: Em um conjunto de teste com textos-base e contextos que contêm informação relevante para enriquecimento, o `GroundedEnricher` produz um texto enriquecido rastreável ao contexto em 100% dos casos.
- **SC-102**: Em um conjunto de teste com contexto insuficiente para enriquecimento, o `GroundedEnricher` aciona o comportamento de fallback configurado em pelo menos 95% dos casos, em vez de inventar enriquecimento.
- **SC-103**: Em um conjunto de teste com mensagens de usuário contendo informação suficiente para os campos definidos, o `GroundedExtractor` extrai valores rastreáveis à mensagem em 100% dos casos.
- **SC-104**: Em um conjunto de teste com mensagens de usuário sem informação suficiente para nenhum campo definido, o `GroundedExtractor` aciona o fallback do objeto completo em pelo menos 95% dos casos, em vez de inventar valores.
- **SC-105**: 100% dos casos de teste já existentes do `GroundedGenerator` continuam passando após o ajuste de descrições de campo, sem nenhuma regressão de comportamento.
- **SC-106**: Em um conjunto de teste com mensagens que preenchem apenas parte dos campos definidos, o `GroundedExtractor` em modo não-estrito (default) retorna os campos extraíveis sem acionar o fallback do objeto inteiro em 100% dos casos; em modo estrito, o mesmo conjunto aciona o fallback do objeto inteiro em 100% dos casos.

## Assumptions

- Os três componentes (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) compartilham a mesma base de configuração e princípios não-negociáveis já estabelecidos na feature 001 (fallback obrigatório, structured output, temperature zero por padrão, distinção entre falha técnica e fallback, sem retry automático, sem suporte a provedores além da OpenAI).
- Assim como no `GroundedGenerator`, `GroundedEnricher` e `GroundedExtractor` operam em modo single-turn (sem histórico de conversa gerenciado pelo componente) e não aplicam redação/mascaramento de dados sensíveis na saída.
- A definição de campos de extração do `GroundedExtractor` é fornecida pelo desenvolvedor no momento da construção do componente (não dinamicamente por chamada) — decisão análoga à forma como o fallback é configurado nos outros componentes.
- O `GroundedDecider` (decisão fechada de ação com confiança via logprob) permanece uma feature futura separada e não é afetado nem implementado por esta feature.
- O `fallbackValue` do `GroundedEnricher` é mantido obrigatório na construção por consistência de API com os demais componentes da família, mesmo não sendo invocado por nenhum fluxo de sucesso definido nesta feature (ver FR-105/FR-106/FR-110) — reservado para uso futuro, não um requisito morto por engano.

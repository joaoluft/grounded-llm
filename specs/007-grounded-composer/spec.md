# Feature Specification: GroundedComposer

**Feature Branch**: `007-grounded-composer`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Novo generator: GroundedComposer. Diferente do GroundedGenerator/GroundedEnricher (que ancoram no `context` e têm gate de suficiência com fallback), o GroundedComposer ancora a saída em `rules` como fonte primária e obrigatória — ele compõe/gera uma mensagem (ex.: a próxima pergunta de um fluxo de coleta de dados) seguindo literalmente as instruções fornecidas em `rules`, sem nunca abster-se ou cair em fallback. O `context` (ex.: resumo da conversa + dados já coletados) é opcional e serve apenas como apoio — para detectar conflito com as regras, reconhecer progresso, ou referenciar dados já mencionados — nunca como critério de suficiência para responder."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compor uma mensagem seguindo instruções obrigatórias, sem abstenção (Priority: P1)

Um desenvolvedor backend está construindo um fluxo de atendimento orientado por regras (ex.: um bot de concessionária que precisa perguntar, campo a campo, os dados de um atendimento). A cada passo, outra parte do sistema já decidiu qual é a próxima informação a coletar e como ela deve ser perguntada; o desenvolvedor precisa apenas de um componente que redija essa pergunta especificamente, seguindo essas instruções ao pé da letra, sempre produzindo uma mensagem — nunca recusando ou substituindo por um texto genérico de fallback.

**Why this priority**: É o caso de uso central do componente. Sem essa garantia (saída sempre produzida a partir das instruções), o componente não se diferencia dos demais generators da família e não resolve o problema que motivou sua criação — um generator existente devolveu uma recusa genérica porque avaliou (incorretamente) que não havia contexto suficiente para responder, quando na verdade a resposta já estava inteiramente determinada pelas regras fornecidas.

**Independent Test**: Pode ser testado fornecendo apenas instruções (regras) descrevendo uma pergunta específica a ser feita, sem nenhum dado de conversa adicional, e verificando que o componente retorna a pergunta redigida de acordo com as instruções, sem se abster e sem produzir uma resposta genérica.

**Acceptance Scenarios**:

1. **Given** instruções descrevendo uma pergunta específica a ser feita a um cliente (incluindo estilo de abertura e opções a apresentar), **When** o componente processa a solicitação sem nenhum dado de conversa adicional, **Then** ele retorna uma mensagem que faz exatamente essa pergunta, seguindo as instruções fornecidas.
2. **Given** as mesmas instruções, **When** o componente processa a solicitação, **Then** o resultado nunca indica abstenção/fallback — uma mensagem final é sempre produzida.

---

### User Story 2 - Usar dados de conversa como apoio, sem que a ausência deles bloqueie a resposta (Priority: P1)

O desenvolvedor quer que o componente também leve em conta um resumo da conversa e os dados já coletados até o momento — por exemplo, para reconhecer o progresso do atendimento na abertura da mensagem, ou para perceber que o cliente mencionou algo que entra em conflito com as regras do negócio (ex.: pediu um veículo de uma marca não atendida) e precisa ser endereçado antes ou junto da próxima pergunta. Esses dados de conversa nunca devem ser tratados como um requisito — sua ausência ou insuficiência não pode impedir a geração da mensagem.

**Why this priority**: É o que diferencia este componente de uma simples repetição de template: ele incorpora contexto conversacional quando disponível e relevante, mas sem herdar o comportamento de "recusar por contexto insuficiente" que existe nos demais componentes da família — comportamento esse que é adequado para Q&A ancorado em contexto, mas incorreto aqui.

**Independent Test**: Pode ser testado fornecendo as mesmas instruções em dois cenários — com e sem dados de conversa — e verificando que em ambos os casos uma mensagem final é produzida; quando há dados de conversa relevantes (incluindo um conflito com as regras do negócio), a mensagem/resultado reflete esse uso; quando não há dados de conversa, o resultado se baseia inteiramente nas instruções.

**Acceptance Scenarios**:

1. **Given** instruções para uma pergunta específica e um resumo de conversa que menciona algo em conflito com regras do negócio descritas nas instruções, **When** o componente processa a solicitação, **Then** o resultado indica que os dados de conversa foram usados, aponta o trecho do resumo que sustenta esse uso, e a mensagem final aborda o conflito antes de (ou junto com) a pergunta determinada pelas instruções.
2. **Given** as mesmas instruções, mas sem nenhum dado de conversa (ou um resumo vazio/em branco), **When** o componente processa a solicitação, **Then** ele retorna a mensagem baseada apenas nas instruções, sem erro e sem abstenção.
3. **Given** instruções e um resumo de conversa que não contém nada relevante para a pergunta a ser feita, **When** o componente processa a solicitação, **Then** o resultado indica que os dados de conversa não foram usados, e a mensagem final é produzida normalmente a partir das instruções.

---

### User Story 3 - Rastrear a mensagem gerada até as instruções fornecidas (Priority: P2)

Um desenvolvedor que já usa o componente em produção quer conseguir auditar por que uma determinada mensagem foi gerada — em particular, confirmar que ela realmente decorre das instruções fornecidas naquela chamada (e não de conhecimento externo ou de uma interpretação livre do modelo), e entender, quando aplicável, que trecho dos dados de conversa influenciou o resultado.

**Why this priority**: Rastreabilidade é a garantia central de "ancoragem" que já existe nos outros componentes da família (trechos extraídos, raciocínio explícito) e deve se manter aqui, mesmo com a fonte de ancoragem invertida (instruções em vez de contexto) — mas não é o comportamento crítico do componente (esse é US1/US2), e sim uma capacidade de suporte/observabilidade.

**Independent Test**: Pode ser testado inspecionando o resultado de qualquer chamada bem-sucedida e verificando que ele contém os trechos literais das instruções que embasam a mensagem gerada, um raciocínio conectando essas instruções (e, quando houver, os dados de conversa usados) à mensagem final.

**Acceptance Scenarios**:

1. **Given** qualquer chamada bem-sucedida ao componente, **When** o resultado é inspecionado, **Then** ele inclui os trechos literais das instruções que sustentam a mensagem gerada, e esses trechos nunca vêm vazios.
2. **Given** qualquer chamada bem-sucedida ao componente, **When** o resultado é inspecionado, **Then** ele inclui um raciocínio explícito conectando as instruções (e os dados de conversa usados, quando houver) à mensagem final.

---

### Edge Cases

- O que acontece quando as instruções fornecidas estão vazias ou em branco? É uso inválido — rejeitado imediatamente como erro, antes de qualquer chamada ao modelo (não há instrução alguma para ancorar a mensagem).
- O que acontece quando os dados de conversa fornecidos estão vazios, em branco, ou ausentes? Tratado como "sem dados de conversa" — o componente segue normalmente, gerando a mensagem só a partir das instruções, sem erro.
- O que acontece quando os dados de conversa contêm informação irrelevante para a pergunta atual (não configura conflito, progresso ou dado a referenciar)? O componente ignora essa informação e gera a mensagem normalmente a partir das instruções, sinalizando no resultado que os dados de conversa não influenciaram a saída.
- O que acontece se as instruções e os dados de conversa "conflitarem" entre si de alguma forma? As instruções sempre prevalecem como fonte da mensagem; o papel dos dados de conversa é, no máximo, informar como a mensagem deve abordar esse conflito (ex.: informar o cliente sobre uma limitação) — nunca impedir ou substituir a mensagem determinada pelas instruções.
- O componente compartilha, com os demais da família (`GroundedGenerator`/`GroundedEnricher`), a possibilidade de personalização via identidade/regras/tom de chamada e o limite de tamanho de entrada — nenhum desses comportamentos já estabelecidos é alterado por esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-701**: O sistema MUST oferecer um novo componente, com uma responsabilidade distinta dos demais da família: compor uma mensagem final ancorada primariamente em instruções fornecidas pelo desenvolvedor a cada chamada, não em contexto recuperado.
- **FR-702**: O componente MUST aceitar, como entrada de cada chamada, instruções (obrigatórias) descrevendo a mensagem a ser composta, e dados de conversa (opcionais) para apoio.
- **FR-703**: O componente MUST rejeitar imediatamente, com um erro de uso inválido e antes de qualquer chamada ao modelo, instruções vazias ou em branco.
- **FR-704**: O componente MUST aceitar dados de conversa ausentes, vazios ou em branco sem erro, tratando esse caso como "nenhum dado de conversa disponível para esta chamada".
- **FR-705**: O componente MUST produzir sempre uma mensagem final a partir das instruções fornecidas — não existe, para este componente, um conceito de contexto/dado insuficiente que resulte em abstenção ou em um valor de fallback substituindo a mensagem.
- **FR-706**: O componente MUST extrair, a partir das instruções fornecidas, os trechos literais que sustentam a mensagem composta, como parte observável do resultado; esses trechos nunca vêm vazios em uma chamada bem-sucedida.
- **FR-707**: O componente MUST determinar explicitamente, quando dados de conversa forem fornecidos, se algum trecho deles influenciou a mensagem composta (por conflito com as instruções, reconhecimento de progresso, ou referência a um dado já mencionado) — essa decisão é observável no resultado, mas nunca impede a produção da mensagem.
- **FR-708**: Quando dados de conversa influenciarem a mensagem composta (conforme FR-707), o componente MUST incluir, no resultado, os trechos literais desses dados que sustentam esse uso.
- **FR-709**: O resultado retornado pelo componente MUST incluir, em toda execução bem-sucedida: a mensagem final composta, indicação explícita de que nenhum fallback foi usado, os trechos extraídos das instruções, os trechos dos dados de conversa que influenciaram o resultado (quando houver), e um raciocínio conectando essas entradas à mensagem final.
- **FR-710**: O componente MUST operar de forma determinística por padrão, consistente com os demais componentes da família.
- **FR-711**: O componente MUST sinalizar de forma distinta uma falha técnica na chamada ao modelo de qualquer outra condição de resultado.
- **FR-712**: O componente MUST oferecer, de forma consistente com os demais componentes da família, a possibilidade de personalização via identidade/regras/tom configurados no momento da construção, sem que isso altere o comportamento central de ancoragem em instruções por chamada descrito nesta feature.
- **FR-713**: O componente MUST reutilizar o mesmo mecanismo de limite de tamanho de entrada (rejeição antecipada quando a chamada excede o limite configurado) já estabelecido pelos demais componentes da família.
- **FR-714**: Esta feature MUST NOT alterar o comportamento observável dos componentes existentes da família (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`).

### Key Entities

- **Instruções da chamada**: o texto, fornecido pelo desenvolvedor a cada chamada, que determina o conteúdo obrigatório da mensagem a ser composta (ex.: qual pergunta fazer, quais opções apresentar, como abrir a mensagem). Fonte primária e obrigatória de ancoragem deste componente — distinta da identidade/regras/tom configurados na construção do componente, que continuam existindo como personalização transversal da chamada ao modelo.
- **Dados de conversa**: informação opcional fornecida a cada chamada (ex.: resumo da conversa, dados já coletados no atendimento) usada apenas como apoio — nunca como critério de suficiência.
- **Resultado da composição**: a mensagem final, junto com os trechos de instrução que a sustentam, os trechos de dados de conversa usados (quando houver), e o raciocínio que conecta essas entradas à mensagem final.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das chamadas com instruções válidas, o componente retorna uma mensagem final não vazia — nunca uma abstenção ou um valor de fallback genérico.
- **SC-002**: Em 100% das chamadas bem-sucedidas, o resultado permite a um desenvolvedor identificar exatamente quais trechos das instruções fornecidas sustentam a mensagem gerada, sem consultar a implementação interna do componente.
- **SC-003**: Um desenvolvedor consegue integrar o componente a um fluxo de coleta de dados campo-a-campo (como o caso de uso que motivou esta feature) sem precisar implementar lógica própria de "sempre responder, mesmo sem contexto suficiente" por cima do componente.
- **SC-004**: A adoção deste componente não introduz nenhuma mudança de comportamento observável nos componentes já existentes da família (verificável pela suíte de testes existente continuando a passar sem modificação).

## Assumptions

- O componente reutiliza a mesma infraestrutura de chamada ao modelo, personalização (identidade/regras/tom) e limite de tamanho de entrada já compartilhada pelos demais componentes da família — apenas o comportamento de ancoragem/suficiência é distinto, não a infraestrutura subjacente.
- "Dados de conversa" é deliberadamente genérico (resumo de conversa, dados já coletados, ou qualquer outro texto de apoio) — esta feature não prescreve um formato específico para esse conteúdo, apenas seu papel (apoio, nunca requisito).
- Não há necessidade de um valor de fallback configurável para este componente, diferente dos demais da família — como o componente nunca se abstém, um fallback não teria caminho de código que o invocasse.
- O caso de uso motivador (redigir a próxima pergunta de um fluxo de atendimento orientado por regras) é representativo da classe mais ampla de problemas que este componente resolve (qualquer mensagem cujo conteúdo já é determinado por instruções explícitas, não por uma busca de informação em contexto), e a feature é especificada nesse nível de generalidade.

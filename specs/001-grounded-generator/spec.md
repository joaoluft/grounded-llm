# Feature Specification: GroundedGenerator

**Feature Branch**: `001-grounded-generator`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Construir GroundedGenerator, um componente de uma lib TypeScript para gerar mensagem final ao usuário ancorada em contexto recuperado, reduzindo alucinação em chatbots comerciais que usam LLM da OpenAI (direto ou via LangChain)."

## Clarifications

### Session 2026-07-15

- Q: O componente deve suportar histórico de conversa (múltiplos turnos) ou apenas interações single-turn? → A: Single-turn apenas: cada chamada é independente, sem memória de turnos anteriores — o desenvolvedor é responsável por incluir qualquer histórico relevante dentro do próprio contexto fornecido.
- Q: O que o componente deve fazer quando o contexto fornecido excede o limite processável pelo modelo de linguagem configurado? → A: Falha explícita: o componente sinaliza um erro operacional distinto (não fallback, não sucesso) quando o contexto excede o limite processável pelo modelo, sem tentar truncar.
- Q: O componente deve aplicar alguma redação/mascaramento de dados sensíveis nos trechos extraídos e no raciocínio antes de retorná-los? → A: Sem redação: os trechos extraídos e o raciocínio são retornados integralmente, como aparecem no contexto original — a responsabilidade por dados sensíveis no contexto é do desenvolvedor que o fornece.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resposta ancorada quando o contexto é suficiente (Priority: P1)

Um desenvolvedor backend integra o componente em um chatbot comercial que já recupera contexto (via RAG ou outra fonte) para responder perguntas de usuários finais. Quando o contexto recuperado contém a informação necessária para responder a pergunta, o componente extrai os trechos relevantes, confirma que o contexto é suficiente, e gera uma resposta final que usa apenas essa informação.

**Why this priority**: É o caminho principal de uso do componente — sem ele, não há valor algum: é a funcionalidade central que substitui a chamada LLM atual do desenvolvedor.

**Independent Test**: Pode ser testado fornecendo um par (contexto, pergunta) onde o contexto contém a resposta, e verificando que a resposta final é gerada, é rastreável até trechos extraídos do contexto, e não contém informação fora dele.

**Acceptance Scenarios**:

1. **Given** um contexto que contém a informação necessária para responder à pergunta do usuário, **When** o componente processa a pergunta com esse contexto, **Then** ele retorna uma resposta final que utiliza apenas trechos presentes no contexto fornecido.
2. **Given** uma resposta final gerada com sucesso, **When** o desenvolvedor inspeciona o resultado retornado, **Then** ele consegue identificar quais trechos do contexto sustentam a resposta e o raciocínio que conecta esses trechos à resposta.

---

### User Story 2 - Fallback quando o contexto é insuficiente (Priority: P1)

Quando o contexto recuperado não contém informação suficiente para responder com segurança, ou quando nenhum trecho relevante é encontrado, o componente não inventa uma resposta. Em vez disso, retorna o valor de fallback que o desenvolvedor configurou antecipadamente, sinalizando claramente que o fallback foi usado.

**Why this priority**: É o comportamento que resolve o problema central de negócio (alucinação). Sem essa garantia, o componente não oferece vantagem sobre a chamada LLM que o desenvolvedor já possui.

**Independent Test**: Pode ser testado fornecendo perguntas cujo contexto não contém a informação necessária, e verificando que o resultado retornado é o fallback configurado, com sinalização explícita de que o fallback foi usado, em vez de uma resposta gerada.

**Acceptance Scenarios**:

1. **Given** um contexto que não contém informação relevante para a pergunta do usuário, **When** o componente processa a pergunta, **Then** ele retorna o valor de fallback configurado e sinaliza que o fallback foi usado, sem gerar uma resposta a partir de conhecimento externo ao contexto.
2. **Given** um contexto do qual nenhum trecho relevante pôde ser extraído, **When** o componente avalia a suficiência do contexto, **Then** ele classifica o contexto como insuficiente e aciona o fallback, mesmo que o contexto não esteja vazio.

---

### User Story 3 - Integração sem reescrever a lógica de retrieval existente (Priority: P2)

Um desenvolvedor que já possui uma lógica de retrieval funcionando (independente de qual orquestração ou framework use, se algum) consegue adotar o componente fornecendo apenas o contexto recuperado e a pergunta — opcionalmente reaproveitando uma instância já configurada do client `openai` que ele já usa em seu projeto — sem precisar reimplementar a recuperação de contexto que já funciona em produção.

**Why this priority**: Reduz o esforço e o risco de adoção — é o que torna viável a troca da chamada atual pelo componente em menos de 30 minutos, mas depende das User Stories 1 e 2 já estarem funcionando corretamente.

**Independent Test**: Pode ser testado instanciando o componente (com ou sem uma instância própria do client `openai`) dentro do projeto do desenvolvedor e confirmando que ele responde corretamente usando a mesma lógica de retrieval, sem alterações nela.

**Acceptance Scenarios**:

1. **Given** um desenvolvedor com uma lógica de retrieval já configurada, **When** ele substitui a chamada de geração atual pelo componente, **Then** a lógica de retrieval permanece inalterada e o componente passa a receber o mesmo contexto recuperado como entrada.
2. **Given** um desenvolvedor que já possui uma instância configurada do client `openai` (com retry, timeout ou baseURL customizados), **When** ele a injeta na construção do componente, **Then** o componente usa essa instância em vez de criar uma nova internamente.

---

### Edge Cases

- O que acontece quando o contexto fornecido está vazio ou em branco? O componente deve tratar isso como contexto insuficiente e acionar o fallback.
- O que acontece quando a pergunta do usuário é ambígua, mas o contexto contém informação parcialmente relacionada? Essa é uma decisão de julgamento inerente ao modelo, aceita intencionalmente como tal nesta feature (não há uma regra objetiva e determinística para "suficiência parcial" definida no spec): o componente deve avaliar, via o mesmo mecanismo de suficiência de FR-002, se essa informação parcial permite responder com segurança; se não for, deve acionar o fallback em vez de arriscar uma resposta incompleta ou especulativa.
- O que acontece quando o contexto contém informação contraditória (duas partes do contexto se contradizem sobre o mesmo fato)? O componente deve tratar essa situação como contexto insuficiente para responder com segurança e acionar o fallback.
- O que acontece se a chamada ao modelo de linguagem falhar ou expirar por motivos técnicos (indisponibilidade, timeout)? Esse cenário é tratado como erro operacional, não como insuficiência de contexto, e está descrito nos requisitos funcionais abaixo.
- O que acontece quando o contexto fornecido excede o limite processável pelo modelo de linguagem configurado? O componente sinaliza um erro operacional explícito e distinto do fallback, sem tentar truncar o contexto silenciosamente.
- O que acontece quando o desenvolvedor não configurou um valor de fallback? Isso não é permitido: um fallback explícito é obrigatório na configuração do componente antes de qualquer uso.
- O que acontece quando o modelo retorna uma saída que falha a validação do schema estruturado, ou recusa responder? Esse cenário é tratado como um erro operacional distinto tanto da falha técnica de comunicação (FR-010) quanto do fallback por contexto insuficiente, e está descrito em FR-012.
- O que acontece quando a pergunta do usuário (`question`) está vazia ou ausente? O componente rejeita a chamada imediatamente como uso inválido, sem chamar o modelo — distinto de contexto insuficiente, que é uma condição sobre o conteúdo do `context`, não sobre a ausência da pergunta em si.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O componente MUST extrair, a partir do contexto fornecido, os trechos literais que sustentam a resposta à pergunta do usuário, antes de gerar qualquer resposta final.
- **FR-002**: O componente MUST determinar explicitamente se o contexto fornecido é suficiente para responder à pergunta com segurança, como uma decisão separada e anterior à geração da resposta final.
- **FR-003**: A resposta final gerada MUST derivar exclusivamente dos trechos extraídos do contexto, sem incorporar informação que não esteja presente nesses trechos.
- **FR-004**: O componente MUST retornar o valor de fallback configurado pelo desenvolvedor, em vez de uma resposta gerada, sempre que o contexto for classificado como insuficiente ou quando nenhum trecho relevante puder ser extraído.
- **FR-005**: O componente MUST exigir que um valor de fallback seja configurado explicitamente no momento da construção do componente; a ausência de um fallback configurado impede o uso do componente. Da mesma forma, qualquer outro parâmetro obrigatório ou malformado na configuração (por exemplo, um identificador de modelo vazio ou inválido) MUST impedir a construção do componente imediatamente, em vez de falhar apenas na primeira chamada de geração.
- **FR-006**: O resultado retornado pelo componente MUST incluir, em toda execução: a resposta final (ou o fallback), uma indicação explícita de se o fallback foi usado, os trechos extraídos que sustentam a resposta (quando houver), e o raciocínio usado para conectar os trechos extraídos à resposta final.
- **FR-007**: O componente MUST permitir que o desenvolvedor forneça o contexto recuperado e a pergunta do usuário como entradas, sem exigir alterações na forma como esse contexto foi originalmente obtido ou montado.
- **FR-008**: O componente aceita, opcionalmente, uma instância já configurada do client oficial `openai` (npm), injetada pelo desenvolvedor que consome a lib (por exemplo, com retry, timeout ou baseURL customizados). Se nenhuma instância for fornecida, o componente MUST criar uma internamente usando `apiKey` (parâmetro explícito ou variável de ambiente `OPENAI_API_KEY`) e o `model` configurado.
- **FR-009**: O componente MUST operar de forma determinística por padrão, priorizando respostas consistentes e reprodutíveis frente à mesma combinação de contexto e pergunta.
- **FR-010**: O componente MUST sinalizar de forma distinta uma falha técnica na chamada ao modelo de linguagem (indisponibilidade, erro de comunicação) de uma decisão de fallback por contexto insuficiente, para que o desenvolvedor consumidor possa tratá-las de forma diferente.
- **FR-011**: O componente MUST sinalizar um erro operacional explícito, distinto do fallback e da resposta bem-sucedida, quando o contexto fornecido exceder o limite processável pelo modelo de linguagem configurado, sem truncar o contexto silenciosamente. Essa verificação MUST aplicar uma margem de segurança em relação ao limite exato do modelo (o valor exato da margem é decisão de implementação, documentada em plan.md/research.md), para evitar comportamento indefinido bem na fronteira do limite.
- **FR-012**: O componente MUST sinalizar um erro operacional explícito e distinto — tanto da falha técnica de comunicação (FR-010) quanto do fallback por contexto insuficiente — quando a resposta do modelo falhar a validação do schema de saída estruturada ou for recusada pelo modelo.

### Key Entities

- **Solicitação de Geração**: Representa uma chamada ao componente, contendo o contexto recuperado (texto) e a pergunta do usuário final a ser respondida.
- **Fatos Extraídos**: Conjunto de trechos literais retirados do contexto fornecido, identificados como relevantes para sustentar a resposta à pergunta.
- **Avaliação de Suficiência**: Decisão explícita sobre se os fatos extraídos e o contexto disponível são suficientes para responder com segurança, sem completar com conhecimento externo.
- **Resultado da Geração**: Saída do componente, contendo a resposta final (ou o valor de fallback), a indicação de uso de fallback, os fatos extraídos e o raciocínio que conecta os fatos à resposta.
- **Configuração do Componente**: Conjunto de parâmetros definidos pelo desenvolvedor no momento da construção do componente, incluindo obrigatoriamente o valor de fallback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em um conjunto de teste com perguntas cujo contexto fornecido não contém a informação necessária, o componente retorna o fallback configurado (em vez de uma resposta inventada) em pelo menos 95% dos casos.
- **SC-002**: Em perguntas com contexto suficiente, 100% das respostas finais geradas são rastreáveis até os trechos extraídos correspondentes, sem acréscimo de informação externa ao contexto.
- **SC-003**: Um desenvolvedor com uma cadeia de geração já configurada consegue, a partir do momento em que começa a ler a documentação de integração (quickstart), substituir sua chamada atual pelo componente e obter a primeira resposta funcional em menos de 30 minutos, sem alterar sua lógica de retrieval existente.
- **SC-004**: 100% das execuções do componente retornam um resultado que indica explicitamente se o fallback foi usado, permitindo rastreabilidade completa sem inspeção de código ou logs adicionais.

## Assumptions

- O contexto recuperado é fornecido ao componente como um único texto já concatenado; a lógica de montagem desse texto (busca, ranking, concatenação) é de responsabilidade do desenvolvedor que consome o componente, não do componente em si.
- Cada chamada ao componente é independente (single-turn): o componente não mantém nem gerencia histórico de conversa entre chamadas; se o desenvolvedor precisar considerar turnos anteriores, ele deve incluí-los como parte do contexto fornecido na chamada atual.
- O componente processa e retorna a resposta de forma completa (não incremental); geração em streaming está fora do escopo desta feature.
- O componente é responsável por sua própria autenticação com a API OpenAI: usa uma instância do client `openai` fornecida pelo desenvolvedor quando disponível, ou cria uma internamente a partir de `apiKey`/`OPENAI_API_KEY` e do `model` configurado; não depende de nenhum framework de orquestração (como LangChain) para funcionar.
- Um banco de exemplos dinâmico (few-shot recuperado por similaridade) e a verificação de consistência pós-geração entre resposta e fatos extraídos são funcionalidades futuras e não fazem parte desta feature.
- Suporte a provedores de linguagem além da API OpenAI está fora do escopo desta feature.
- Quando partes do contexto se contradizem entre si sobre o mesmo fato, o componente trata isso como insuficiência de contexto e aciona o fallback, em vez de tentar resolver a contradição.
- O componente não aplica redação ou mascaramento de dados sensíveis (PII) nos trechos extraídos ou no raciocínio retornado; qualquer necessidade de proteção de dados sensíveis no contexto é de responsabilidade do desenvolvedor que fornece esse contexto.
- O componente é stateless e não mantém nenhum estado mutável compartilhado entre chamadas; múltiplas chamadas concorrentes à mesma instância do componente são seguras, já que cada chamada opera apenas sobre seus próprios parâmetros de entrada.
- O componente não realiza retry automático em caso de `OperationalError` (falha técnica, saída inválida, ou contexto excedendo o limite); a decisão de tentar novamente é de responsabilidade do desenvolvedor que consome a lib.
- Metas de performance e latência (tempo de resposta, throughput) não fazem parte do escopo desta feature; a latência observada é a latência inerente à chamada ao modelo de linguagem configurado.

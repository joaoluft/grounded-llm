# Feature Specification: Suporte a modelo LangChain no GroundedCall (tracing LangSmith)

**Feature Branch**: `006-langchain-model-support`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Suporte a modelo LangChain no GroundedCall: permitir que o dev passe um langchainModel (BaseChatModel do LangChain) já configurado como alternativa ao client OpenAI nativo, para manter tracing do LangSmith, sem afetar o modo standalone existente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usar um chat model LangChain já configurado para manter o tracing do LangSmith (Priority: P1)

Um desenvolvedor já usa LangChain/LangSmith no restante da sua aplicação e quer que as chamadas feitas pelos componentes da família (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) apareçam nos traces do LangSmith, exatamente como as demais chamadas de modelo da sua aplicação. Hoje isso não é possível porque os componentes só aceitam um client OpenAI nativo.

**Why this priority**: É o cenário de uso principal que motivou o pedido — sem essa capacidade, o desenvolvedor não consegue observar as chamadas do pacote junto com o restante do seu pipeline LangChain.

**Independent Test**: Pode ser testado configurando um `GroundedGenerator` com um chat model LangChain (já configurado com suas próprias credenciais) em vez de um client/apiKey OpenAI, executando uma chamada, e confirmando que a chamada é feita através do chat model LangChain fornecido (e portanto visível para qualquer instrumentação de tracing associada a ele).

**Acceptance Scenarios**:

1. **Given** um `GroundedGenerator` configurado com um chat model LangChain válido, **When** o desenvolvedor chama o método de geração, **Then** o componente usa esse chat model para obter a resposta, em vez de criar ou usar um client OpenAI nativo.
2. **Given** um `GroundedGenerator` configurado da forma tradicional (client/apiKey OpenAI, sem chat model LangChain), **When** o desenvolvedor chama o método de geração, **Then** o comportamento é idêntico ao atual — nenhuma regressão no modo standalone.

---

### User Story 2 - Resultado estruturado idêntico independente do backend usado (Priority: P1)

Um desenvolvedor que alterna entre o modo standalone (OpenAI direto) e o modo LangChain — por exemplo, ao migrar sua aplicação para usar LangChain, ou ao testar localmente sem LangChain e rodar em produção com LangChain — espera que o resultado retornado por qualquer componente da família (resposta final, fatos extraídos, indicação de fallback, raciocínio) tenha exatamente o mesmo formato e semântica nos dois modos.

**Why this priority**: Sem essa garantia, o suporte a LangChain seria uma API paralela e não uma alternativa transparente — quebrando a promessa de "sem afetar o modo standalone existente" e obrigando o desenvolvedor a tratar os dois modos de forma diferente no código consumidor.

**Independent Test**: Pode ser testado executando a mesma requisição (mesmo contexto/pergunta) contra um componente configurado em modo standalone e contra o mesmo componente configurado em modo LangChain (com respostas de modelo equivalentes simuladas), e comparando que o formato do resultado retornado é o mesmo.

**Acceptance Scenarios**:

1. **Given** um componente da família configurado em modo LangChain, **When** o modelo retorna uma saída estruturada válida, **Then** o resultado retornado ao desenvolvedor segue exatamente o mesmo formato (campos e tipos) que o modo standalone retornaria para uma saída equivalente.
2. **Given** um componente da família configurado em modo LangChain, **When** a chamada ao modelo falha (erro de rede/API) ou a saída não corresponde ao schema esperado, **Then** o componente lança o mesmo tipo de erro operacional que já lançaria no modo standalone para a falha equivalente (erro de indisponibilidade do modelo ou de saída inválida).

---

### User Story 3 - Configuração inválida é rejeitada de forma clara (Priority: P2)

Um desenvolvedor tenta configurar um componente passando, ao mesmo tempo, um chat model LangChain e também um client/apiKey/model/temperatura no estilo OpenAI nativo (por engano, ou por não perceber que os dois modos são mutuamente exclusivos).

**Why this priority**: Evita comportamento ambíguo/silencioso (qual dos dois seria usado?) e reduz o risco de configuração incorreta em produção. É um refinamento sobre a capacidade central (US1), que já entrega valor sozinha.

**Independent Test**: Pode ser testado configurando um componente com um chat model LangChain e, simultaneamente, um `client` (ou `apiKey`, `model` ou `temperature`) OpenAI, e confirmando que a construção do componente falha com um erro claro em vez de escolher silenciosamente um dos dois modos.

**Acceptance Scenarios**:

1. **Given** uma configuração que inclui tanto um chat model LangChain quanto qualquer um dos campos do modo OpenAI nativo (`client`, `apiKey`, `model` ou `temperature`), **When** o desenvolvedor tenta construir o componente, **Then** a construção falha imediatamente com uma mensagem de erro explicando que os dois modos são mutuamente exclusivos.

---

### Edge Cases

- O que acontece se `maxContextTokens` não for informado no modo LangChain (já que não há um `model` OpenAI do qual derivar o limite conhecido)? O sistema assume um limite conservador padrão (128.000 tokens) em vez de exigir configuração adicional ou lançar erro.
- O que acontece se `maxContextTokens` for informado explicitamente no modo LangChain? O valor informado é respeitado, como já ocorre hoje no modo standalone.
- O que acontece se o chat model LangChain fornecido não suportar saída estruturada (não implementar o mecanismo esperado)? A chamada falha e o componente lança o mesmo erro operacional usado para outras falhas de chamada ao modelo (indisponibilidade), permitindo ao desenvolvedor diagnosticar o problema.
- O que acontece com os campos opcionais de composição de prompt já existentes (`identity`, `rules`, `tone`, `fallbackValue`)? Continuam funcionando de forma idêntica em ambos os modos — eles afetam apenas o conteúdo enviado ao modelo, não o backend usado para enviá-lo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE aceitar, na construção de `GroundedGenerator`, `GroundedEnricher` e `GroundedExtractor` (via `GroundedCall`), um novo parâmetro opcional que recebe um chat model LangChain já configurado pelo desenvolvedor.
- **FR-002**: Quando esse parâmetro for fornecido, o sistema DEVE usar o chat model LangChain fornecido para realizar as chamadas ao modelo, em vez de criar ou usar um client OpenAI nativo.
- **FR-003**: O sistema DEVE rejeitar, com um erro de configuração claro lançado na construção do componente, qualquer combinação em que o chat model LangChain seja fornecido junto com `client`, `apiKey`, `model` ou `temperature` (modo OpenAI nativo) — os dois modos são mutuamente exclusivos, pois o chat model LangChain já traz sua própria configuração de credenciais, modelo e temperatura.
- **FR-004**: Quando o chat model LangChain for usado sem um `maxContextTokens` explícito, o sistema DEVE aplicar um limite de contexto padrão conservador (128.000 tokens) em vez de exigir configuração adicional.
- **FR-005**: Quando `maxContextTokens` for fornecido explicitamente junto com o chat model LangChain, o sistema DEVE respeitá-lo, com a mesma verificação de estouro de contexto (erro de contexto grande demais) já aplicada no modo standalone.
- **FR-006**: O sistema DEVE produzir, no modo LangChain, um resultado com exatamente o mesmo formato (campos e tipos) que o modo standalone produz para uma resposta de modelo equivalente.
- **FR-007**: O sistema DEVE traduzir falhas na chamada ao chat model LangChain (erro de rede/API) para o mesmo tipo de erro operacional já usado hoje para falhas equivalentes de chamada ao modelo no modo standalone.
- **FR-008**: O sistema DEVE traduzir falhas de saída estruturada no modo LangChain (saída que não corresponde ao schema esperado) para o mesmo tipo de erro operacional já usado hoje para falhas equivalentes de saída inválida no modo standalone.
- **FR-009**: O comportamento dos campos opcionais existentes (`identity`, `rules`, `tone`, `fallbackValue`, verificação de tamanho de contexto) DEVE ser idêntico em ambos os modos — eles não devem exigir nenhuma configuração ou comportamento diferente por causa do backend usado.
- **FR-010**: Quando o chat model LangChain NÃO for fornecido, o sistema DEVE se comportar exatamente como hoje — nenhuma regressão no modo standalone existente.
- **FR-011**: A capacidade DEVE estar disponível de forma consistente nos três componentes da família (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`), por herdarem da mesma base comum.
- **FR-012**: O suporte a chat model LangChain DEVE ser um recurso opcional do pacote — instalar e usar o pacote sem essa capacidade NÃO DEVE exigir a instalação de nenhuma biblioteca adicional relacionada a LangChain.

### Key Entities *(include if feature involves data)*

- **Chat model LangChain (`langchainModel`)**: instância de um chat model LangChain já configurada pelo desenvolvedor (credenciais, modelo, temperatura, etc.), fornecida como alternativa ao client OpenAI nativo. O componente a utiliza apenas para realizar as chamadas ao modelo; não gerencia nem valida sua configuração interna.
- **Modo de operação (standalone vs. LangChain)**: propriedade derivada da configuração de cada componente — determina qual backend é usado para as chamadas ao modelo, sem alterar nenhum outro comportamento observável do componente (composição de prompt, fallback, formato do resultado, tipos de erro).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um desenvolvedor consegue configurar qualquer um dos três componentes com um chat model LangChain e obter um resultado de chamada válido, sem precisar fornecer nenhuma credencial ou configuração adicional no estilo OpenAI nativo.
- **SC-002**: 100% dos testes automatizados existentes para os três componentes no modo standalone continuam passando sem alteração após a mudança.
- **SC-003**: Para uma mesma resposta de modelo equivalente, o formato do resultado retornado (campos e tipos) é idêntico entre o modo standalone e o modo LangChain em 100% dos casos testados.
- **SC-004**: 100% das tentativas de configurar simultaneamente o chat model LangChain e qualquer campo do modo OpenAI nativo (`client`, `apiKey`, `model`, `temperature`) resultam em erro de configuração na construção do componente, nunca em uso silencioso de um dos dois modos.
- **SC-005**: Projetos que não usam a capacidade de chat model LangChain não sofrem nenhum aumento no tamanho de dependências instaladas do pacote.

## Assumptions

- Este é um ajuste aditivo sobre a família de componentes já existente (`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`) e sua base comum (`GroundedCall`), reaproveitando toda a lógica de composição de prompt, fallback e validação de contexto já existente.
- O chat model LangChain fornecido pelo desenvolvedor já vem configurado com suas próprias credenciais, identificador de modelo e temperatura — o componente não os configura nem os valida além de checar que os dois modos não foram combinados.
- O mecanismo de saída estruturada do chat model LangChain fornecido é capaz de produzir uma saída aderente a um schema informado (capacidade padrão dos chat models LangChain com suporte a saída estruturada); chat models sem esse suporte resultam em falha de chamada, tratada como erro operacional de indisponibilidade.
- A integração com bibliotecas LangChain é opcional para o pacote (dependência de par opcional) — só é necessária para quem efetivamente usa essa capacidade.
- O tracing do LangSmith em si é responsabilidade do ecossistema LangChain (variáveis de ambiente/configuração padrão do LangChain); este pacote não implementa nem gerencia diretamente esse tracing, apenas permite que as chamadas passem por um chat model LangChain para que esse tracing, se configurado, funcione naturalmente.

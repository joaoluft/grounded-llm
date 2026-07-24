# Phase 0 Research: Suporte a modelo LangChain no GroundedCall

## R1: Como extrair o JSON Schema já usado hoje pelo modo OpenAI, para reaproveitar no `withStructuredOutput` do LangChain?

- **Decision**: Ler `response_format.json_schema.schema` (JSON Schema puro) e
  `response_format.json_schema.name` diretamente do objeto retornado por
  `zodResponseFormat(schema, name)` (helper já usado pelos três generators), e
  passá-los para `langchainModel.withStructuredOutput(schema, { name })`.
- **Rationale**: Inspecionado `node_modules/openai/helpers/zod.mjs` —
  `zodResponseFormat` retorna `{ type: 'json_schema', json_schema: { name, strict,
  schema } }`, onde `schema` já é um JSON Schema plano (produzido por
  `zodToJsonSchema`). Isso evita duplicar a definição do schema (não precisamos do
  objeto Zod original nem de re-derivar nada) e evita qualquer acoplamento a
  internals privados do parser da OpenAI (o parsing automático da OpenAI usa uma
  closure interna não exposta — não tentamos reaproveitá-la).
  `withStructuredOutput` do LangChain aceita tanto um schema Zod quanto um JSON
  Schema puro (`Record<string, any>`), detectando o tipo em runtime.
- **Alternatives considered**: Fazer os generators passarem o schema Zod bruto
  para `callModel` (mudaria a assinatura pública, rejeitado explicitamente durante o
  brainstorming); re-serializar o schema Zod a partir do zero no adapter (duplicação
  desnecessária).

## R2: Como enviar as mensagens (system/user) para o chat model LangChain sem depender de classes do `@langchain/core` em runtime?

- **Decision**: Converter `messages: [{ role, content }]` (formato já usado pelos
  generators) para o formato de tuplas aceito nativamente por
  `BaseChatModel.invoke`/`Runnable.invoke`: `[[role, content], ...]` (ex.:
  `[["system", "..."], ["user", "..."]]`). Esse formato é parte do tipo
  `BaseLanguageModelInput` do LangChain e é resolvido internamente para
  `SystemMessage`/`HumanMessage`, sem exigir que o adapter importe essas classes.
- **Rationale**: Evita import de `@langchain/core/messages` em runtime — só o tipo
  `BaseChatModel` (via `import type`) é necessário para a assinatura pública do
  campo `langchainModel`, mantendo o footprint de runtime mínimo mesmo quando a
  feature está em uso.
- **Alternatives considered**: Importar `SystemMessage`/`HumanMessage` de
  `@langchain/core/messages` e instanciá-las explicitamente — funciona igual, mas
  adiciona um import runtime extra sem benefício, já que o formato de tuplas é
  suportado de forma estável pela API pública do LangChain.

## R3: Dependência — peerDependency opcional vs. dependência regular

- **Decision**: `@langchain/core` entra em `peerDependencies` com
  `peerDependenciesMeta["@langchain/core"].optional = true`. Como devDependency, para
  build/type-check do próprio pacote e para os testes do adapter.
- **Rationale**: Decisão já validada com o usuário durante o brainstorming — quem usa
  só o modo standalone não deve instalar nada relacionado a LangChain (FR-012/SC-005).
  Usar `import type` para o tipo `BaseChatModel` no campo de config não gera nenhum
  import de runtime; o adapter (`langchain-model-client.ts`) só é exercitado quando
  `langchainModel` é de fato passado, e nesse ponto o consumidor já tem
  `@langchain/core` instalado (é dele que a instância do chat model veio).
- **Trade-off assumido**: como o tipo público (`GroundedCallConfig.langchainModel`)
  referencia um tipo de `@langchain/core` via `import type`, consumidores que
  type-checam contra a `.d.ts` deste pacote podem precisar de `@langchain/core`
  resolvível no `node_modules` para essa checagem ser completa, mesmo que nunca usem
  o campo — mitigado na prática pelo `skipLibCheck` (default `true` na maioria dos
  templates de `tsconfig`) e documentado no README como pré-requisito de quem quiser
  o campo tipado. Essa troca foi aceita explicitamente pelo usuário em favor de manter
  o tipo oficial do LangChain em vez de uma interface estrutural própria.
- **Alternatives considered**: Interface estrutural própria (duck typing, zero
  dependência mesmo para tipos) — descartada explicitamente pelo usuário em favor do
  tipo oficial `BaseChatModel`.

## R4: Limite de contexto padrão quando `langchainModel` é usado sem `maxContextTokens`

- **Decision**: Default fixo de 128.000 tokens quando `langchainModel` é fornecido e
  `maxContextTokens` é omitido (`getMaxContextTokens` não é chamado, já que não há
  `model` OpenAI do qual derivar um limite conhecido).
- **Rationale**: Decisão já validada com o usuário — evita exigir configuração
  adicional obrigatória, à custa de ser conservador o suficiente para não deixar
  passar prompts claramente grandes demais para a maioria dos modelos atuais.
- **Alternatives considered**: Exigir `maxContextTokens` explícito nesse modo
  (rejeitado — mais fricção); tentar introspectar o chat model LangChain em busca de
  algum campo de limite de contexto (rejeitado — não há convenção estável entre
  providers/integrações LangChain para isso).

## R5: Mapeamento de erros do adapter LangChain

- **Decision**: Qualquer erro lançado por `langchainModel.withStructuredOutput(...).
  invoke(...)` — seja falha de rede/API do provider subjacente, seja falha de
  parsing/validação da saída estruturada — é capturado e relançado como
  `ModelUnavailableError` (falha de chamada) ou `InvalidModelOutputError` (saída que
  não valida contra o schema), replicando a mesma distinção já feita hoje em
  `callModel` para o modo OpenAI.
- **Rationale**: Decisão já validada com o usuário — mesmo mapeamento do modo OpenAI,
  sem introduzir um terceiro tipo de erro. Como o LangChain não distingue de forma
  padronizada entre "erro de chamada" e "erro de parsing" através de tipos de exceção
  estáveis e comuns a todos os providers, o adapter classifica pelo estágio em que o
  erro ocorreu: erro lançado por `.invoke(...)` em si → `ModelUnavailableError`; saída
  obtida mas inconsistente com o schema esperado (quando detectável, ex.: exceção de
  parsing do próprio `withStructuredOutput`, ou resultado `null`/`undefined`) →
  `InvalidModelOutputError`.
- **Alternatives considered**: Novo tipo de erro dedicado ao adapter — rejeitado
  explicitamente pelo usuário.

## R6: Onde extrair a lógica hoje embutida em `callModel` sem mudar sua assinatura pública

- **Decision**: Introduzir uma interface interna `ModelClient` (arquivo novo
  `src/core/model-client.ts`) com um único método usado por `callModel`. A
  implementação `OpenAiModelClient` encapsula exatamente a lógica hoje inline em
  `callModel` (chamada a `client.beta.chat.completions.parse`, tratamento de
  `LengthFinishReasonError`/`ContentFilterFinishReasonError`/refusal). `callModel`
  passa a chamar `this.modelClient.parse(params)`; o constructor de `GroundedCall`
  decide qual implementação instanciar.
- **Rationale**: Mantém `callModel` e os três generators absolutamente inalterados
  (mesma assinatura, mesmo tipo de retorno), como validado com o usuário durante o
  brainstorming. Isola toda a nova complexidade dentro de `core/`.
- **Alternatives considered**: Ramificar diretamente dentro de `callModel` com um
  `if (this.langchainModel)` — funcionaria, mas misturaria as duas implementações no
  mesmo método, dificultando testar cada uma isoladamente; rejeitado em favor da
  interface `ModelClient`.

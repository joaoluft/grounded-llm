# Quickstart: Validating Token Usage & Cost Metadata

## Prerequisites

- Repo installed (`npm install`)
- No API keys needed — validation uses the existing mocked provider adapters in `tests/unit` and `tests/contract`

## Automated validation

```bash
npm run test          # vitest run — includes new/updated usage assertions
npm run typecheck      # tsc --noEmit (or equivalent script — check package.json)
npm run build          # tsup, confirms d.ts still compiles with the added optional field
```

Expected: all suites green, no new type errors, build succeeds.

## Manual/exploratory check (standalone mode)

```ts
import { GroundedGenerator } from 'grounded-llm';

const generator = new GroundedGenerator({
  apiKey: process.env.OPENAI_API_KEY!,
  provider: 'openai',
  model: 'gpt-4o-mini',
});

const result = await generator.generate({ /* ...prompt args... */ });
console.log(result.usage);
// => { promptTokens: 123, completionTokens: 45, totalTokens: 168 }
```

## Manual/exploratory check (langchainModel mode)

```ts
import { GroundedGenerator } from 'grounded-llm';
import { ChatOpenAI } from '@langchain/openai';

const generator = new GroundedGenerator({
  langchainModel: new ChatOpenAI({ model: 'gpt-4o-mini' }),
});

const result = await generator.generate({ /* ...prompt args... */ });
console.log(result.usage); // => undefined (documented behavior)
```

## Aggregation pattern (from the README example)

```ts
let totals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
for (const call of calls) {
  const result = await generator.generate(call);
  totals.promptTokens += result.usage?.promptTokens ?? 0;
  totals.completionTokens += result.usage?.completionTokens ?? 0;
  totals.totalTokens += result.usage?.totalTokens ?? 0;
}
```

Expected: `totals` equals the sum of each call's individually-logged `usage`, confirming SC-003.

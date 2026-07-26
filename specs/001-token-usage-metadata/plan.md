# Implementation Plan: Token Usage & Cost Metadata

**Branch**: `6-add-token-usage-cost-metadata-to-groundedresult` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-token-usage-metadata/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Thread the token usage data that provider adapters (OpenAI/Anthropic/Google) already compute in `ProviderResponse.usage` (`src/providers/types.ts`) through `GroundedCall.callModel` and into each generator's returned result object, as an optional `usage` field. `langchainModel` mode keeps returning `usage: undefined` (no `includeRaw` plumbing) since the issue only requires documented absence there, not extraction. Document the field and an aggregation pattern in the README (EN + PT).

## Technical Context

**Language/Version**: TypeScript 5.6, Node >=20, ESM (`"type": "module"`)

**Primary Dependencies**: None new. Existing: `openai`, `@anthropic-ai/sdk` (or equivalent adapter deps), optional `@langchain/core` peer for `langchainModel` mode.

**Storage**: N/A (no persistence — in-memory result object only)

**Testing**: Vitest (`vitest run`), existing `tests/unit/` and `tests/contract/providers/llm-provider.contract.test.ts`

**Target Platform**: Node.js library (ESM + CJS build via tsup), consumed by other Node/TS backends

**Project Type**: Library (single project, `src/` + `tests/`)

**Performance Goals**: N/A — reading an already-computed field, no added latency

**Constraints**: Must not change existing public return shapes in a breaking way (`usage` is additive/optional); must not throw when usage is unavailable

**Scale/Scope**: Touches `src/core/grounded-call.ts`, `src/core/types.ts`, `src/core/langchain-model-client.ts`, all 4 generator files under `src/generators/`, `README.md`, plus corresponding tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is an unfilled template (no project-specific principles ratified yet) — no formal gates to check against. Falling back to the coding norms already enforced in this repo (CLAUDE.md): no speculative abstractions, no new dependencies, additive/optional fields over breaking changes, tests alongside implementation. This plan complies: `usage` is optional on existing result types, no new dependencies, no new abstractions beyond a field addition and a small return-type threading change.

**Result**: PASS (no violations, Complexity Tracking not needed).

## Project Structure

### Documentation (this feature)

```text
specs/001-token-usage-metadata/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature extends an existing library return type, it does not add a new public entrypoint/API surface distinct from what `data-model.md` already documents.

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts                  # GroundedCallResult — add optional `usage` field
│   ├── grounded-call.ts          # callModel — thread ProviderResponse.usage through
│   └── langchain-model-client.ts # unchanged behavior, usage stays undefined
├── providers/
│   └── types.ts                  # ProviderUsage/ProviderResponse already define usage (no change needed)
└── generators/
    ├── grounded-generator.ts     # attach usage to GroundedCallResult
    ├── grounded-enricher.ts      # attach usage to GroundedCallResult
    ├── grounded-extractor.ts     # attach usage to GroundedExtractionResult
    └── grounded-composer.ts      # attach usage to its inline result type

tests/
├── unit/core/grounded-call.test.ts        # usage threading from provider response
├── unit/generators/*.test.ts              # usage present/absent per generator
└── contract/providers/llm-provider.contract.test.ts  # unchanged (already asserts ProviderResponse.usage shape)

README.md   # new "Token usage & cost metadata" section (EN + PT)
```

**Structure Decision**: Single project (library). No new directories — this is a targeted extension of existing `src/core` and `src/generators` files plus their existing test siblings, following the codebase's existing generator/provider split.

## Complexity Tracking

*No violations — Constitution Check passed. Table not applicable.*

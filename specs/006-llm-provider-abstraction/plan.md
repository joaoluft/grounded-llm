# Implementation Plan: Multi-provider LLM Abstraction

**Branch**: `006-llm-provider-abstraction` | **Date**: 2026-07-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-llm-provider-abstraction/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Introduce a provider abstraction layer for LLM communication so the library can support multiple model providers in a pluggable way while preserving current OpenAI behavior and public API compatibility. The plan delivers: a documented provider contract, OpenAI adapter migration to that contract, Anthropic and Google provider integrations in this increment, contract-level tests shared by all providers, and updated user documentation for provider selection and extension.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >=20

**Primary Dependencies**: openai (existing), zod (existing), vitest, tsup, eslint/prettier

**Storage**: N/A (library with no persistent storage)

**Testing**: vitest unit + contract + integration suites

**Target Platform**: Node.js library consumers (ESM and CJS package exports)

**Project Type**: TypeScript library

**Performance Goals**: Maintain current response-time profile for default provider path; provider dispatch overhead should be negligible compared to network-bound model calls

**Constraints**: Zero breaking changes to public API, deterministic provider-selection precedence, clear misconfiguration errors, keep OpenAI as default behavior

**Scale/Scope**: Refactor core call path plus generator/extractor/enricher integration; deliver Anthropic and Google as non-OpenAI providers in this iteration; establish extension model for future providers (xAI, DeepSeek, others)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The constitution file is currently a template with placeholders and no enforceable concrete principles. Following repository precedent, gate validation is performed against explicit project constraints from spec and existing release practices.

Pre-Phase 0 gate review:

- Backward compatibility preserved as a mandatory constraint
- Test-first quality gate maintained via required contract and integration tests
- No governance conflicts identified with project structure or release process

✅ **GATE PASSED (Pre-Phase 0)**

Post-Phase 1 re-check:

- Design artifacts preserve public API surface
- Contracts and validation guidance are defined before implementation
- No unresolved clarification markers remain in planning artifacts

✅ **GATE PASSED (Post-Phase 1)**

## Project Structure

### Documentation (this feature)

```text
specs/006-llm-provider-abstraction/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── llm-provider.md
│   └── library-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── index.ts
├── core/
│   ├── context-window.ts
│   ├── errors.ts
│   ├── grounded-call.ts
│   └── types.ts
└── generators/
    ├── grounded-generator.ts
    ├── grounded-extractor.ts
    ├── grounded-enricher.ts
    ├── grounded-generator.schema.ts
    ├── grounded-extractor.schema.ts
    ├── grounded-enricher.schema.ts
    └── schema.ts

tests/
├── contract/
│   └── generators/
└── unit/
    ├── core/
    └── generators/
```

**Structure Decision**: Keep the single-library project structure and introduce provider abstractions under existing core/generator boundaries. New provider-specific behavior is encapsulated behind contract-driven adapters to avoid API churn.

## Design Artifacts Generated

### Phase 0: Research

✅ `research.md` — Decisions for provider contract shape, selection precedence, provider set for this increment, error taxonomy, and testing strategy.

### Phase 1: Design

✅ `data-model.md` — Entities, relationships, validation rules, and state transitions for provider abstraction.

✅ `contracts/llm-provider.md` — Provider contract specification for current and future adapters.

✅ `contracts/library-api.md` — Backward compatibility and external API behavior contract.

✅ `quickstart.md` — End-to-end validation scenarios and expected outcomes.

## Complexity Tracking

No constitution violations requiring explicit justification.

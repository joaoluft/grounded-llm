# Implementation Plan: Structured Logging Hooks

**Branch**: `008-structured-logging-hooks` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-structured-logging-hooks/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add three optional, independent lifecycle callbacks — `onCall`, `onResult`, `onError` — to
`GroundedCallConfig`, so a developer can observe every call of any grounded component
(`GroundedGenerator`, `GroundedEnricher`, `GroundedExtractor`, `GroundedComposer`) without
wrapping call sites. The callbacks are dispatched by a single new protected helper on the
shared `GroundedCall` base class that wraps each component's public entry-point method
(`generate`/`extract`/`compose`), so the behavior is identical in standalone and
`langchainModel` mode. Payloads carry only metadata (a per-call correlation id, an
operation label, elapsed time, fallback usage, and — on failure — a specific operational
error classification) and never raw call content. Callback exceptions are swallowed so
they can never affect the call's own result.

## Technical Context

**Language/Version**: TypeScript over Node.js 20+ (same base as prior features)

**Primary Dependencies**: none new — uses `node:crypto` (`randomUUID`) from the Node.js
standard library for correlation ids; no new runtime dependency added

**Storage**: N/A (callbacks are synchronous, fire-and-forget function calls — no
persistence)

**Testing**: `vitest`, following the existing pattern (`tests/unit/core/` for the shared
`GroundedCall` wrapping behavior, `tests/unit/generators/` for per-component wiring),
mocking `ModelClient`/`OpenAiModelClient` the same way existing generator tests do

**Target Platform**: Node.js 20+ (server-side); same dual ESM+CJS distribution via `tsup`

**Project Type**: library (extends the existing core module, no new top-level module)

**Performance Goals**: Callback dispatch must add negligible overhead to a call (id
generation + a few synchronous function calls); no callback is ever awaited, so a slow
callback cannot add to a call's latency

**Constraints**: Callbacks are synchronous/fire-and-forget (never awaited); a callback
that throws must never propagate or alter the call's own result or error (spec FR-007);
payloads carry metadata only — no raw context/question/rules/answer text (spec FR-005);
exactly one of `onResult`/`onError` fires per call attempt once `onCall` has fired (spec
FR-006); behavior with no callbacks configured is unchanged (spec FR-009)

**Scale/Scope**: Touches the shared `GroundedCall` base class and the four existing
generator entry points; no new top-level module, no change to any structured-output
schema or to `GroundedCallResult`/`GroundedExtractionResult` shape

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` remains the unfilled template, as in every prior
feature (001–007) — the table below reuses the same nine principles already established
and reused across those plans.

| Principle | Gate | Status |
|---|---|---|
| 1. Library-first | Callbacks are a config addition to the existing `GroundedCall` base and its subclasses in `src/core/` / `src/generators/` — no new top-level module | PASS |
| 2. Nunca gerar sem contenção | Not applicable — this feature adds observability around calls, it does not touch structured-output generation | PASS (N/A) |
| 3. Fallback obrigatório | Not applicable — unaffected; `onResult` only reports the existing `usedFallback` flag, it does not change fallback behavior | PASS (N/A) |
| 4. Extração antes de geração | Not applicable — unaffected; no change to any component's extraction/sufficiency logic | PASS (N/A) |
| 5. Confiança é dado objetivo | Not applicable — out of scope, no confidence/logprob computation involved | PASS (N/A) |
| 6. Temperature zero por padrão | Not applicable — unaffected; no change to temperature resolution | PASS (N/A) |
| 7. TDD estrito | Tests for the shared lifecycle wrapper (correlation id, exactly-one-terminal-callback, callback-exception isolation, no-callbacks-configured no-op) and per-component wiring written before implementation | PASS (to verify during tasks/implementation) |
| 8. Observabilidade por design | This feature directly extends this principle beyond the existing per-result fields — it gives a caller-side hook into every call's lifecycle, not just the returned result | PASS |
| 9. Provider único no MVP | Not applicable — unaffected; the wrapper sits above `callModel`, agnostic to which provider or backend (`OpenAiModelClient`/`LangChainModelClient`/provider adapter) actually served the call | PASS (N/A) |

No violations identified. "Complexity Tracking" section does not apply.

**Post-Phase 1 re-check**: `data-model.md` and `contracts/lifecycle-callbacks.md` confirm
the wrapper only adds a construction-time config surface and a per-call correlation id —
`GroundedCallResult`/`GroundedExtractionResult` themselves are unchanged (principle 8
satisfied without a breaking shape change). Gate PASS maintained.

## Project Structure

### Documentation (this feature)

```text
specs/008-structured-logging-hooks/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── lifecycle-callbacks.ts   # New — CallEvent/ResultEvent/ErrorEvent types,
│   │                             # LifecycleErrorType, classifyOperationalError()
│   ├── types.ts                 # Modified — onCall/onResult/onError added to
│   │                             # GroundedCallConfig
│   └── grounded-call.ts         # Modified — new protected withLifecycle() wrapper,
│                                 # stores resolved callbacks from config
└── generators/
    ├── grounded-generator.ts    # Modified — generate() body moved to a private method,
    │                             # public generate() delegates through withLifecycle()
    ├── grounded-enricher.ts     # Modified — same refactor for its generate()
    ├── grounded-extractor.ts    # Modified — same refactor for extract()
    └── grounded-composer.ts     # Modified — same refactor for compose()

tests/
└── unit/
    ├── core/
    │   └── lifecycle-callbacks.test.ts   # New — withLifecycle() behavior: correlation
    │                                      # id, exactly-one-terminal-callback, callback
    │                                      # exception isolation, no-callbacks no-op,
    │                                      # error classification mapping
    └── generators/
        ├── grounded-generator.test.ts    # Modified — adds callback-wiring assertions
        ├── grounded-enricher.test.ts     # Modified — same
        ├── grounded-extractor.test.ts    # Modified — same
        └── grounded-composer.test.ts     # Modified — same

README.md   # Modified — new "Structured logging hooks" section (English + Português)
```

**Structure Decision**: Single-project structure, unchanged from prior features. The new
callback types and dispatch logic live in one new file (`src/core/lifecycle-callbacks.ts`)
alongside the existing `core/` modules, reused by `GroundedCall` and, transitively, by
all four generators — no new top-level directory, no new runtime dependency.

## Complexity Tracking

*No Constitution Check violations — section not applicable.*

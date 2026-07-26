# Implementation Plan: Pluggable Result Cache

**Branch**: `10-pluggable-result-cache-to-prevent-redundant-duplicate-calls` | **Date**: 2026-07-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-pluggable-result-cache/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add an optional `cache` option to `GroundedCallConfig` — a minimal `{ get(key), set(key,
value) }` contract the caller implements against whatever storage they choose (in-memory
Map, Redis, etc). When configured, each of the four generators (`GroundedGenerator`,
`GroundedEnricher`, `GroundedExtractor`, `GroundedComposer`) derives a deterministic key
from its request's content fields plus the output-affecting per-instance configuration
(`identity`/`rules`/`tone`, `model`/`temperature`, and, for the extractor, `fields`/
`strict`), checks the cache before running the pipeline, and stores the result after a
fresh run. This is wired into the existing `withLifecycle` wrapper (008-structured-logging-hooks)
so a cache hit still fires `onCall`/`onResult` with the real (cached) outcome, and any
cache failure (lookup or write) is swallowed so it never turns into a request failure.
No cache configured means zero behavior change (FR-001, SC-002).

## Technical Context

**Language/Version**: TypeScript over Node.js 20+ (same base as prior features)

**Primary Dependencies**: none new — uses `node:crypto` (`createHash`) from the Node.js
standard library to derive a fixed-length cache key from request content; no new runtime
dependency added

**Storage**: N/A for the library itself — the feature defines a contract for a
caller-supplied store; no storage backend is bundled or required

**Testing**: `vitest`, following the existing pattern (`tests/unit/core/` for the shared
`GroundedCall`/`withLifecycle` caching behavior and key derivation, `tests/unit/generators/`
for per-component wiring), using a simple in-memory `Map`-backed fake cache and a
rejecting/throwing fake cache to exercise the failure-isolation paths

**Target Platform**: Node.js 20+ (server-side); same dual ESM+CJS distribution via `tsup`

**Project Type**: library (extends the existing core module, no new top-level module)

**Performance Goals**: A cache hit must avoid the model provider entirely, turning a
multi-step pipeline call into a single cache lookup; key derivation itself must stay
O(size of request) with no network calls

**Constraints**: Cache is entirely opt-in — omitting it must leave every existing test and
integration unaffected (spec FR-001, SC-002); the library defines no invalidation/expiry
policy (FR-006); a cache lookup or write failure must never fail the request it's
attached to (FR-007); the cache contract must work with both synchronous and
Promise-returning implementations without requiring the caller to adapt (FR-008);
`onCall`/`onResult`/`onError` must keep firing with accurate data for cached results too
(FR-009)

**Scale/Scope**: Touches the shared `GroundedCall` base class (`cache` field, key
derivation helper, `withLifecycle` short-circuit) and the four existing generator entry
points (each computes its own key input and passes it through); no new top-level module,
no change to `GroundedCallResult`/`GroundedExtractionResult` shape

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` remains the unfilled template, as in every prior feature
(001–008) — the table below reuses the same nine principles already established and
reused across those plans.

| Principle | Gate | Status |
|---|---|---|
| 1. Library-first | `cache` is a config addition to the existing `GroundedCall` base and its subclasses in `src/core/` / `src/generators/` — no new top-level module | PASS |
| 2. Nunca gerar sem contenção | Not applicable — a cache hit returns a result the pipeline itself already produced and validated on a prior call; no new, unvalidated generation path is introduced | PASS (N/A) |
| 3. Fallback obrigatório | Not applicable — unaffected; a cached fallback result is returned as-is, exactly as the pipeline produced it (spec Edge Cases) | PASS (N/A) |
| 4. Extração antes de geração | Not applicable — unaffected; caching only short-circuits *repeat* requests, the extract-before-generate order is untouched for every cache-miss (i.e. every first-time) request | PASS (N/A) |
| 5. Confiança é dado objetivo | Not applicable — out of scope, no confidence/logprob computation involved | PASS (N/A) |
| 6. Temperature zero por padrão | Reinforced — `temperature` participates in cache-key derivation, so a non-default temperature (non-deterministic by nature) never collides with a temperature-zero call's cached entry | PASS |
| 7. TDD estrito | Tests for key derivation (stability, sensitivity to each output-affecting field), the `withLifecycle` cache short-circuit (hit/miss/get-failure/set-failure), and per-component wiring written before implementation | PASS (to verify during tasks/implementation) |
| 8. Observabilidade por design | Reinforced — `onCall`/`onResult` still fire on a cache hit with the real (cached) result and duration, so callers cannot mistake a cache hit for a call that never happened (FR-009) | PASS |
| 9. Provider único no MVP | Not applicable — unaffected; the cache short-circuit sits above `callModel`/`withLifecycle`, agnostic to which provider or backend actually served the original (cached) call | PASS (N/A) |

No violations identified. "Complexity Tracking" section does not apply.

**Post-Phase 1 re-check**: `data-model.md` and `contracts/result-cache.md` confirm the
cache short-circuit only adds a construction-time config surface and a per-call key
derivation step — `GroundedCallResult`/`GroundedExtractionResult` themselves are
unchanged (principle 8 satisfied without a breaking shape change). Gate PASS maintained.

## Project Structure

### Documentation (this feature)

```text
specs/009-pluggable-result-cache/
├── plan.md               # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md          # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── result-cache.ts          # New — ResultCache interface, deriveCacheKey() helper
│   │                              # (stable-stringify + sha256 over request/config input)
│   ├── types.ts                 # Modified — `cache?: ResultCache` added to
│   │                              # GroundedCallConfig
│   └── grounded-call.ts         # Modified — stores resolved cache from config;
│                                  # withLifecycle() gains an optional cacheKey param and
│                                  # short-circuits fn() on a cache hit, writes through on
│                                  # a cache miss, swallows get/set failures
└── generators/
    ├── grounded-generator.ts    # Modified — computes cache key input from
    │                              # {context, question} and passes it to withLifecycle()
    ├── grounded-enricher.ts     # Modified — same, from {baseContent, context}
    ├── grounded-extractor.ts    # Modified — same, from {message} plus fields/strict
    └── grounded-composer.ts     # Modified — same, from {instructions, context}

tests/
└── unit/
    ├── core/
    │   └── result-cache.test.ts        # New — deriveCacheKey() stability/sensitivity,
    │                                    # withLifecycle() cache hit/miss/get-failure/
    │                                    # set-failure, sync- and Promise-returning cache
    │                                    # implementations
    └── generators/
        ├── grounded-generator.test.ts  # Modified — adds cache-wiring assertions
        ├── grounded-enricher.test.ts   # Modified — same
        ├── grounded-extractor.test.ts  # Modified — same
        └── grounded-composer.test.ts   # Modified — same

README.md   # Modified — new "Result cache" section (English + Português)
```

**Structure Decision**: Single-project structure, unchanged from prior features. The new
cache contract and key-derivation logic live in one new file (`src/core/result-cache.ts`)
alongside the existing `core/` modules, reused by `GroundedCall` and, transitively, by all
four generators — no new top-level directory, no new runtime dependency.

## Complexity Tracking

*No Constitution Check violations — section not applicable.*

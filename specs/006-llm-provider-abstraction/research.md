# Research: Multi-provider LLM Abstraction

**Feature**: Multi-provider LLM Abstraction | **Date**: 2026-07-24

## Decisions

### 1. Provider Contract Shape

**Decision**: Define a provider contract with one required operation for this release (`completeStructured`) and optional capabilities for streaming and embeddings.

**Rationale**:

- Current library behavior is centered on structured completion flows in generator/extractor/enricher.
- A minimal required contract reduces migration risk while enabling immediate multi-provider support.
- Optional capabilities create an extension path for future feature families without blocking this release.

**Alternatives considered**:

- Require complete + stream + embed for all providers (rejected: over-constrains providers and delays delivery).
- Keep provider calls as free-form function injection (rejected: weak contract and inconsistent contributor experience).

### 2. OpenAI Migration Strategy

**Decision**: Move existing OpenAI-specific behavior behind an OpenAI adapter that implements the provider contract, preserving OpenAI as the default path.

**Rationale**:

- Maintains backward compatibility for existing users.
- Isolates provider-specific client logic from core feature behavior.
- Allows incremental rollout and targeted troubleshooting.

**Alternatives considered**:

- Big-bang rewrite of all generators first, then providers (rejected: high regression risk).
- Keep OpenAI in core and add side-path adapters (rejected: duplicated logic and long-term coupling).

### 3. Additional Providers for This Increment

**Decision**: Add Anthropic and Google as non-OpenAI providers delivered in this feature.

**Rationale**:

- Strong adoption signal and clear community demand.
- Covers two major provider ecosystems in the first release of the abstraction.
- Validates abstraction quality across more than one non-OpenAI adapter while still keeping scope bounded.

**Alternatives considered**:

- Anthropic-only in this increment (rejected: lower immediate adoption coverage).
- Ship only abstraction and no new provider (rejected: does not satisfy feature acceptance criteria).

### 4. Provider Selection Precedence

**Decision**: Use deterministic precedence: explicit runtime parameter > environment variable > default provider.

**Rationale**:

- Predictable behavior across environments.
- Parameter-first precedence is the most explicit and testable.
- Retains no-config default behavior for current users.

**Alternatives considered**:

- Environment variable overriding parameter (rejected: surprising in application code).
- Fail when both sources are present (rejected: unnecessary friction).

### 5. Error Handling Standardization

**Decision**: Normalize provider selection and credential/configuration failures into clear library-level error categories and remediation messages.

**Rationale**:

- Prevents provider SDK details from leaking into user-facing behavior.
- Supports consistent developer ergonomics across providers.
- Enables contract tests to enforce failure semantics.

**Alternatives considered**:

- Pass through raw provider errors (rejected: inconsistent and harder to debug).
- Use silent fallbacks for misconfiguration (rejected: unsafe and ambiguous behavior).

### 6. Test Strategy

**Decision**: Add provider-agnostic contract tests plus provider-specific integration tests for OpenAI, Anthropic, and Google paths.

**Rationale**:

- Contract tests protect long-term extensibility and contribution quality.
- Integration tests ensure each adapter is operational and compatible with core workflows.
- Preserves regression coverage for default OpenAI behavior while validating two non-default providers.

**Alternatives considered**:

- Integration-only testing (rejected: insufficient abstraction guarantees).
- Unit-only adapter testing with no end-to-end checks (rejected: weak confidence in real behavior).

## Resolved Unknowns

- Contract minimum required operations: resolved to one mandatory structured completion operation with optional capabilities.
- Additional providers in this increment: resolved to Anthropic and Google.
- Provider precedence semantics: resolved to parameter > environment > default.
- Error behavior across providers: resolved to normalized library-level error surface.
- Coverage model: resolved to contract + integration tests.

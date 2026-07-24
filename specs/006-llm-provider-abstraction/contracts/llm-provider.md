# Contract: LLM Provider Abstraction

**Feature**: Multi-provider LLM Abstraction | **Date**: 2026-07-24

## Purpose

Define the minimum provider adapter contract required by grounded-llm so multiple LLM vendors can be integrated with consistent behavior.

## Provider Identifier Contract

- Each provider exposes a stable `providerId` string.
- `providerId` must be unique in the provider registry.
- The configured provider name must match a registered `providerId` exactly.

## Required Operation Contract

### completeStructured(request)

All providers MUST implement the structured completion operation used by current grounded flows.

**Input Contract**:

- Accept normalized prompt/instruction content from library flows.
- Accept schema constraints required to validate output shape.
- Accept call options (model, temperature, and provider-agnostic metadata).

**Output Contract**:

- Return normalized parsed data matching requested schema when successful.
- Include finish status and optional usage metadata.
- Avoid exposing provider SDK-specific types to external callers.

**Failure Contract**:

- Map technical call failures to library-level availability errors.
- Map schema/refusal/unusable output to library-level invalid-output errors.
- Include actionable remediation hints for configuration and selection failures.

## Optional Capability Contracts

### stream(request)

- Optional capability for token/chunk streaming.
- If unsupported, provider must declare capability as unavailable and fail with standardized unsupported-capability error when requested.

### embed(request)

- Optional capability for embeddings.
- Same capability declaration and unsupported behavior rules as streaming.

## Provider Selection Contract

Selection MUST be deterministic using precedence:

1. Explicit runtime provider parameter
2. Environment-configured provider
3. Default provider

If the selected provider is unknown or unavailable, the system MUST fail fast with a clear provider-selection error.

## Configuration Contract

- Provider-specific required configuration (credentials and mandatory options) must be validated before outbound calls.
- Missing or invalid configuration must produce clear user-facing errors without secret leakage.

## Compatibility Contract

- Public API entry points remain unchanged for existing users.
- OpenAI remains default provider behavior when no provider is configured.
- Existing baseline behavior and response structures remain compatible in default configuration.

## Test Contract

Every provider released in this feature MUST pass:

- Shared provider contract tests validating required behavior and error semantics.
- Provider-specific integration tests validating real request lifecycle through the grounded flow.

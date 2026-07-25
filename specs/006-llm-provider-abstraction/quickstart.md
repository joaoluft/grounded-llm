# Quickstart: Multi-provider LLM Abstraction Validation

**Feature**: Multi-provider LLM Abstraction | **Date**: 2026-07-24

## Objective

Validate end-to-end behavior for provider abstraction, backward compatibility, and support for Anthropic and Google in addition to OpenAI.

## Prerequisites

- Node.js 20+ installed
- Dependencies installed with npm install
- Valid credentials for OpenAI, Anthropic, and Google available for integration scenarios
- Working directory at repository root

## Scenario 1: Backward Compatibility With Default Provider

**Objective**: Confirm existing usage works without provider configuration changes.

**Steps**:

1. Run baseline test subsets for generator/extractor/enricher paths.
2. Execute full test suite for regressions.

**Commands**:

- npm test

**Expected Outcome**:

- Existing OpenAI-centric baseline tests continue to pass.
- No test updates are required solely due to provider abstraction.

## Scenario 2: Provider Selection Precedence

**Objective**: Confirm deterministic precedence between parameter and environment configuration.

**Steps**:

1. Set provider via environment.
2. Run a validation call without explicit provider and verify environment-selected provider path.
3. Run the same call with explicit provider parameter and verify parameter overrides environment.

**Expected Outcome**:

- Selection order follows parameter > environment > default.
- Selected provider is observable through deterministic test assertions.

## Scenario 3: Non-OpenAI Providers End-to-End

**Objective**: Validate Anthropic and Google providers in the same core grounded flow.

**Steps**:

1. Configure Anthropic provider credentials.
2. Configure Google provider credentials.
3. Run integration test scenarios through grounded flow.

**Commands**:

- npm test -- tests/unit/generators/
- npm test -- tests/contract/

**Expected Outcome**:

- Anthropic and Google paths return valid normalized responses.
- Contract tests and provider-specific integration tests pass for all three providers in scope.

## Scenario 4: Contract Enforcement for Providers

**Objective**: Validate that shared provider contract tests guard adapter behavior.

**Steps**:

1. Run provider contract tests for all included providers.
2. Verify OpenAI, Anthropic, and Google satisfy required contract checks.

**Expected Outcome**:

- All required contract tests pass for included providers.
- Any missing required operation fails tests with clear contract mismatch messaging.

## Scenario 5: Misconfiguration and Unsupported Provider Errors

**Objective**: Validate user-facing failure quality for invalid provider selection/configuration.

**Steps**:

1. Attempt call with unsupported provider name.
2. Attempt call with selected provider missing required credentials.

**Expected Outcome**:

- System fails fast with actionable, standardized error messages.
- Errors do not leak secrets.

## Validation Checklist

- Default behavior remains backward compatible for existing users.
- Provider selection precedence is deterministic.
- Anthropic and Google providers pass end-to-end scenarios.
- Shared contract tests validate all included providers.
- Misconfiguration errors are clear and actionable.

## Related Artifacts

- Provider abstraction contract: contracts/llm-provider.md
- External API compatibility: contracts/library-api.md
- Entity and lifecycle design: data-model.md

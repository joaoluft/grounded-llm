# Public API Contract: Multi-provider LLM Abstraction

**Feature**: Multi-provider LLM Abstraction | **Date**: 2026-07-24

## Goal

Guarantee that the multi-provider design does not break existing grounded-llm consumers while enabling provider selection and extension.

## Existing Entry Point Compatibility

The following externally consumed components remain available and behaviorally compatible under default configuration:

- GroundedGenerator
- GroundedExtractor
- GroundedEnricher
- GroundedCall and exported error types

**Compatibility Rule**:

- Existing integrations that do not set provider configuration continue using default provider path with no required API migration.

## New Configuration Surface Contract

A provider can be selected through supported configuration sources without removing existing options.

**Behavior Rules**:

- Existing config remains valid.
- Provider selection follows deterministic precedence (parameter > environment > default).
- Invalid provider selection fails with explicit error and guidance.

## Response Behavior Contract

- Successful calls preserve current response shape expected by existing users.
- Fallback semantics remain aligned with current component behavior.
- Operational failures remain distinct from fallback outcomes.

## Error Contract

Errors surfaced to library users remain understandable and actionable:

- Provider selection/configuration errors explain how to correct configuration.
- Provider availability errors communicate technical failure without exposing secrets.
- Invalid model output errors preserve structured-output guarantees.

## Documentation Contract

README updates for this feature must include:

- Supported providers list for the release.
- How to choose a provider.
- How to add a new provider via adapter contract.
- Backward-compatibility expectations for existing OpenAI users.

Supported providers for this release:

- OpenAI (default)
- Anthropic (Claude)
- Google (Gemini)

Planned expansion model for future providers:

- Architecture supports adding xAI (Grok), DeepSeek, and others through new adapters implementing the same provider contract, without major refactoring of core flows.

## Verification Contract

Feature completion requires:

- Existing OpenAI baseline tests pass unchanged.
- Anthropic and Google providers pass integration tests.
- Shared provider contract tests pass for all included providers.

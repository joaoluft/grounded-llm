# Data Model: Multi-provider LLM Abstraction

**Feature**: Multi-provider LLM Abstraction | **Date**: 2026-07-24

## Core Entities

### 1. LLMProviderContract

Represents the required behavior every provider adapter must implement.

**Fields**:

- `providerId`: stable provider identifier (e.g., openai, anthropic)
- `capabilities`: declared support for optional operations
- `completeStructured(request)`: required operation used by grounded flows
- `stream(request)`: optional operation for future streaming flows
- `embed(request)`: optional operation for future embedding flows

**Validation Rules**:

- `providerId` must be non-empty and unique among registered providers.
- `completeStructured` must return responses in normalized library shape.
- Optional operations may be absent, but capability declarations must match actual behavior.

### 2. ProviderAdapter

Concrete provider implementation bound to a single model vendor.

**Fields**:

- `providerId`
- `configurationSchema`
- `credentialsResolver`
- `capabilityProfile`

**Relationships**:

- Implements exactly one `LLMProviderContract`.
- Registered inside `ProviderRegistry`.
- Consumes `ProviderSelectionConfig` and `ProviderRequest`.

### 3. ProviderSelectionConfig

User-facing configuration used to select active provider.

**Fields**:

- `provider` (optional runtime parameter)
- `providerEnv` (optional environment source)
- `defaultProvider` (library default)
- `providerOptions` (provider-specific non-secret options)

**Validation Rules**:

- Selection precedence is deterministic: parameter > environment > default.
- Selected provider must exist in registry.
- Provider-specific required configuration must be present before call execution.

### 4. ProviderRequest

Normalized request payload sent from grounded flows to provider adapters.

**Fields**:

- `operation`: structured completion operation type
- `model`: logical model selection
- `temperature`
- `messages/systemInstructions`
- `schemaDefinition`
- `requestContext` (trace/meta)

**Validation Rules**:

- `operation` must be supported by selected provider capability profile.
- Request schema must be valid before provider call.
- Context limits are validated before outbound requests.

### 5. ProviderResponse

Normalized provider output consumed by existing library flows.

**Fields**:

- `data` (schema-conformant parsed result)
- `rawText` (optional provider output text)
- `usage` (optional token/usage metadata)
- `finishStatus`
- `providerMeta`

**Validation Rules**:

- `data` must conform to expected schema for successful responses.
- Non-success statuses must map to standardized error categories.

### 6. ProviderError

Normalized library-level error for provider selection and execution failures.

**Fields**:

- `category` (selection, auth, unavailable, output-invalid, unsupported-capability)
- `message`
- `providerId` (if known)
- `remediationHint`

**Validation Rules**:

- Error category must be one of the known taxonomy values.
- Message must be actionable and not expose secrets.

## Relationships Overview

- `ProviderRegistry` holds multiple `ProviderAdapter` instances keyed by `providerId`.
- `ProviderSelectionConfig` resolves one active provider from registry.
- Grounded flows produce `ProviderRequest` and consume `ProviderResponse`.
- Failures are mapped to `ProviderError` categories for consistency.

## State Transitions

### Provider Resolution Lifecycle

1. `Configuration Received`
2. `Provider Selected` (precedence applied)
3. `Provider Config Validated`
4. `Request Validated`
5. `Provider Invoked`
6. `Response Normalized`
7. `Delivered to Existing Flow`

Error transitions:

- From step 2 -> `Selection Error` when provider is unsupported.
- From step 3 -> `Configuration Error` when credentials/options are missing.
- From step 5 -> `Availability Error` when provider call fails technically.
- From step 6 -> `Output Validation Error` when provider output is unusable.

## Invariants

- Existing public API entry points remain unchanged.
- OpenAI remains default provider when no provider is explicitly set.
- Current increment registry includes OpenAI, Anthropic, and Google provider adapters.
- All released providers must pass shared provider contract tests.
- Provider-specific internals must not leak into external API contracts.

# Phase 1 Data Model: Generator Error-Path Coverage & CI Summary

No new or changed data entities. This feature adds test cases against the existing,
already-documented error types (`ModelUnavailableError`, `ContextTooLargeError`,
`InvalidModelOutputError` — defined in `src/core/errors.ts`) and adds a CI workflow
step. No new types, fields, or state transitions are introduced in `src/`.

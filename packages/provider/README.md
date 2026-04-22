# @openmerch/provider

Preview TypeScript types for OpenMerch provider integrations. Defines the type contracts for service registration, pricing models, and execution handling on the OpenMerch protocol.

`@openmerch/provider` publishes the provider-side type contract for services building against the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>: service definition shapes, execution handler interfaces, and payment-aware integration points.

> **Preview** — This package exports TypeScript types and interfaces only. Runtime registration, request handling, and related client helpers are still under development. Install today to build against the type surface.

## What Works Today

- All provider-side type definitions: `ServiceDefinition`, `PricingModel`, `ExecutionRequest`, `ExecutionResult`, handler types, and more
- Handler function signatures for sync, async, and streaming execution modes
- Pricing types expressed in USD-denominated units

## What Is Not Yet Shipped

- Runtime server or framework adapter for handling live execution requests
- Polished client helpers for service registration with the OpenMerch network

## Installation

```bash
npm install @openmerch/provider
```

## Overview

This package provides the type definitions and interfaces for the provider side of the OpenMerch protocol. The type surface models three execution modes:

- **Sync** — request/response, returns a result immediately
- **Async** — returns a job ID, result is retrieved later
- **Stream** — emits a sequence of chunks as the execution progresses

## Usage

The snippet below uses `import type` to show the contracts your code can build against before runtime clients ship.

```ts
import type {
  ProviderConfig,
  ServiceDefinition,
  SyncHandler,
  ExecutionRequest,
  ExecutionResult,
} from "@openmerch/provider";

// Define a service
const echoService: ServiceDefinition = {
  id: "echo",
  name: "Echo Service",
  description: "Returns the input payload unchanged",
  modes: ["sync"],
  pricing: { basePrice: "0", currency: "USD" },
};

// Implement a sync handler
const handleEcho: SyncHandler = async (req: ExecutionRequest): Promise<ExecutionResult> => ({
  requestId: req.requestId,
  success: true,
  data: req.payload,
});
```

## Exported Types

- `ServiceDefinition` — metadata for a service listing
- `PricingModel` — pricing attached to a service
- `ExecutionMode` — `"sync" | "async" | "stream"`
- `ExecutionRequest` — incoming request from an agent
- `ExecutionResult` — result from a sync execution
- `StreamChunk` — a single chunk in a streaming response
- `SyncHandler`, `AsyncHandler`, `StreamHandler` — handler function types
- `ExecutionHandlers` — map of mode to handler
- `ProviderConfig` — full provider configuration

## Payment Support

Pricing is expressed in USD-denominated units for accounting. Onchain settlement types model USDC on Base and Base Sepolia.

## Pre-1.0 Stability

This package is versioned below 1.0. Before 1.0, minor releases may include breaking changes.

## License

[MIT](../../LICENSE)

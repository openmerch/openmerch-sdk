# @openmerch/provider

Preview TypeScript types for building job execution backends on the OpenMerch network. Defines the type contracts for service definition, pricing models, and execution handling.

In V1, OpenMerch routes all jobs internally. This package is for building execution backends that plug into the provider inventory.

> **Preview** — This package exports TypeScript types and interfaces only. Runtime registration, request handling, and related client helpers are still under development. Install today to build against the type surface.

## What Works Today

- All provider-side type definitions: `ServiceDefinition`, `PricingModel`, `ExecutionRequest`, `ExecutionResult`, handler types, and more
- Handler function signatures for sync, async, and streaming execution modes
- Pricing types expressed in USD-denominated units

## What Is Not Yet Shipped

- Runtime server or framework adapter for handling live job execution requests
- Polished client helpers for service registration with the OpenMerch network

## Installation

```bash
npm install @openmerch/provider
```

## Overview

This package provides the type definitions and interfaces for the provider side of the OpenMerch network — services that execute jobs routed by OpenMerch. The type surface models three execution modes:

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

// Define a service in the provider inventory
const echoService: ServiceDefinition = {
  id: "echo",
  name: "Echo Service",
  description: "Returns the input payload unchanged",
  modes: ["sync"],
  pricing: { basePrice: "0", currency: "USD" },
};

// Implement a sync handler for incoming job execution requests
const handleEcho: SyncHandler = async (req: ExecutionRequest): Promise<ExecutionResult> => ({
  requestId: req.requestId,
  success: true,
  data: req.payload,
});
```

## Exported Types

- `ServiceDefinition` — metadata describing a service in the provider inventory
- `PricingModel` — pricing attached to a service
- `ExecutionMode` — `"sync" | "async" | "stream"`
- `ExecutionRequest` — incoming job execution request routed by OpenMerch
- `ExecutionResult` — result from a sync execution
- `StreamChunk` — a single chunk in a streaming response
- `SyncHandler`, `AsyncHandler`, `StreamHandler` — handler function types
- `ExecutionHandlers` — map of mode to handler
- `ProviderConfig` — full provider configuration

## Payment Support

OpenMerch compensates providers for completed jobs. Pricing in microcents. Settlement handled by the platform.

## Pre-1.0 Stability

This package is versioned below 1.0. Before 1.0, minor releases may include breaking changes.

## License

[MIT](../../LICENSE)

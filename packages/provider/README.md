# @openmerch/provider

TypeScript SDK for OpenMerch service providers. Define services, set pricing, and handle execution requests from agents over the OpenMerch protocol.

## Installation

```bash
npm install @openmerch/provider
```

## Overview

This package provides the type definitions and interfaces for building an OpenMerch provider. Providers register services on the network and implement handlers for three execution modes:

- **Sync** — request/response, returns a result immediately
- **Async** — returns a job ID, result is retrieved later
- **Stream** — emits a sequence of chunks as the execution progresses

## Usage

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

## Current Scope

This package currently exports type definitions and interfaces. Runtime client functionality is under active development. Check the [changelog](https://github.com/openmerch/openmerch-sdk/releases) for updates.

## License

[MIT](../../LICENSE)

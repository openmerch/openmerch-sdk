# @openmerch/agent

Preview TypeScript types for OpenMerch agent integrations. Defines the type contracts for service discovery, task execution, and wallet modeling on the OpenMerch protocol.

`@openmerch/agent` publishes the agent-side type contract for clients building against the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>: discovery queries, execution request shapes, and payment-aware integration points.

> **Preview** — This package exports TypeScript types and interfaces only. Runtime client functionality is still under development. Install today to build against the type surface.

## What Works Today

- All agent-side type definitions: `AgentConfig`, `ServiceQuery`, `TaskRequest`, `TaskResult`, `WalletBalance`, and more
- Type-safe modeling of sync, async, and streaming execution modes
- Pricing types expressed in USD-denominated units

## What Is Not Yet Shipped

- Runtime HTTP/WebSocket client for connecting to the OpenMerch network
- Polished client helpers for service discovery or task execution
- Wallet client helpers for balance reads or transaction submission

## Installation

```bash
npm install @openmerch/agent
```

## Overview

This package provides the type definitions and interfaces for the agent side of the OpenMerch protocol. The type surface covers:

- **Discovery** — query shapes for finding services by keyword, price, or execution mode
- **Execution** — request and result types for sync, async, and streaming tasks
- **Wallet** — balance and transaction types for payment-aware integration

## Usage

The snippet below uses `import type` to show the contracts your code can build against before runtime clients ship.

```ts
import type {
  AgentConfig,
  ServiceQuery,
  TaskRequest,
  TaskResult,
  WalletBalance,
} from "@openmerch/agent";

// Search for services
const query: ServiceQuery = {
  keyword: "translation",
  mode: "sync",
  maxPrice: "500",
  currency: "USD",
};

// Build a task request
const task: TaskRequest = {
  serviceId: "translation-v1",
  mode: "sync",
  payload: { text: "Hello", targetLang: "es" },
  maxPrice: "100",
};
```

## Exported Types

- `ServiceQuery` — filter criteria for service discovery
- `ServiceListing` — a service returned from discovery
- `ServiceQueryResult` — paginated discovery results
- `TaskRequest` — request to execute a task
- `TaskResult` — result from a sync execution
- `AsyncTaskHandle` — handle for polling async tasks
- `TaskStreamChunk` — a chunk from a streaming execution
- `WalletBalance` — current wallet balance
- `WalletTransaction` — a single transaction record
- `AgentConfig` — agent connection configuration

## Payment Support

Pricing is expressed in USD-denominated units for accounting. Onchain settlement types model USDC on Base and Base Sepolia.

## Pre-1.0 Stability

This package is versioned below 1.0. Before 1.0, minor releases may include breaking changes.

## License

[MIT](../../LICENSE)

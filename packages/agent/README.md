# @openmerch/agent

TypeScript SDK for OpenMerch agents. Discover services, execute tasks against providers, and manage wallet balances on the OpenMerch protocol.

`@openmerch/agent` is intended for clients and agents that need to discover and invoke machine payable services through OpenMerch and the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>. It focuses on the public agent-side contract: discovery, execution requests, and payment-aware integration points.

## Installation

```bash
npm install @openmerch/agent
```

## Overview

This package provides the type definitions and interfaces for building an OpenMerch agent. Agents interact with the network to:

- **Discover** available services by keyword, price, or execution mode
- **Execute** tasks against provider services (sync, async, or streaming)
- **Manage** wallet balances and track transaction history

## Usage

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

## Current Scope

This package currently exports type definitions and interfaces. Runtime client functionality is under active development. Check the [changelog](https://github.com/openmerch/openmerch-sdk/releases) for updates.

## License

[MIT](../../LICENSE)

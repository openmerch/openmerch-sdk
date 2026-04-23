# @openmerch/agent

Preview TypeScript types for OpenMerch agent integrations. Defines the type contracts for job planning, execution, and result handling on the OpenMerch platform.

> **Preview** — This package exports TypeScript types and interfaces only. Runtime client functionality is still under development. Install today to build against the type surface.

## What Works Today

- All agent-side type definitions: `AgentConfig`, `TaskRequest`, `TaskResult`, and more
- Job execution request and result shapes for sync, async, and streaming modes
- Cost types expressed in microcents

## What Is Not Yet Shipped

- Runtime HTTP/WebSocket client for connecting to the OpenMerch network
- `planJob()` and `executeJob()` methods
- Card-on-file billing helpers

## Installation

```bash
npm install @openmerch/agent
```

## Overview

This package provides the type definitions and interfaces for the agent side of the OpenMerch platform. The type surface covers:

- **Job Execution** — request and result types for submitting jobs and handling structured output
- **Configuration** — agent connection and authentication settings
- **Billing** — cost types in microcents, card-on-file billing

## Usage

This package exports TypeScript types and interfaces only. Use `import type` in your TypeScript files to model your integration against the current published surface:

```ts
import type {
  AgentConfig,
  TaskRequest,
  TaskResult,
} from "@openmerch/agent";

const config: AgentConfig = {
  endpoint: "https://api.openmerch.dev",
  apiKey: process.env.OPENMERCH_API_KEY ?? "dev-key",
};

const task: TaskRequest = {
  serviceId: "lead_qualification_v1",
  mode: "sync",
  payload: { domain: "acme.com" },
  maxPrice: "250000",
};

const result: TaskResult = {
  taskId: "task-demo-001",
  success: true,
  data: { domain: "acme.com", qualified: true },
  cost: { amount: "250000", currency: "USD" },
};

console.log(config.endpoint);
console.log(task.serviceId);
console.log(result.success);
```

For a runnable mocked demo, see [`examples/agent-basic`](../../examples/agent-basic).

## Exported Types

### Job Types

These types will be renamed to match the job-oriented surface (e.g., `JobRequest`, `JobResult`) in an upcoming pre-1.0 release.

- `TaskRequest` — job execution request
- `TaskResult` — result from a sync job execution
- `AsyncTaskHandle` — handle for polling async jobs
- `TaskStreamChunk` — a chunk from a streaming job execution

### Configuration

- `AgentConfig` — agent connection and authentication configuration

### Legacy Types (V0)

These types reflect an earlier service-discovery model and will be removed before 1.0.

- `ServiceQuery` — filter criteria for finding services (V0)
- `ServiceListing` — a service record returned from a query (V0)
- `ServiceQueryResult` — paginated query results (V0)
- `WalletBalance` — wallet balance (replaced by card-on-file billing)
- `WalletTransaction` — transaction record (replaced by card-on-file billing)

## Payment Support

Jobs have a cost. Costs accrue to your account and your card is charged automatically. Values in microcents (1 USD = 1,000,000). Wallet and onchain types are V0 artifacts being removed.

## Roadmap

### Target Runtime Agent API

> Not yet implemented. The runtime client below is the planned integration surface, not part of the published package today.

```ts
import { OpenMerchAgent } from "@openmerch/agent";

// PLANNED API — not yet available
const agent = new OpenMerchAgent({
  baseUrl: "https://api.openmerch.dev",
  apiKey: process.env.OPENMERCH_API_KEY!,
});

const plan = await agent.planJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
});

const job = await agent.executeJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
  max_cost: plan.estimated_cost.max_microcents,
  idempotency_key: `lead-acme-${Date.now()}`,
});

console.log(job.output);
console.log(job.cost);
```

## Pre-1.0 Stability

This package is versioned below 1.0. Before 1.0, minor releases may include breaking changes.

## License

[MIT](../../LICENSE)

# OpenMerch SDK

[OpenMerch](https://openmerch.dev) is a job execution layer for AI agents. Agents submit jobs by type, get structured results back, and pay per job with usage-based billing. This repo publishes preview TypeScript type contracts for building against the OpenMerch platform.

OpenMerch is launching app-first — the hosted app and backend API are the primary integration path. These SDK packages are published for early adopters, protocol exploration, and future direct integrators.

> **Preview** — These packages publish TypeScript types, interfaces, and reference contracts. Runtime client functionality is still under development. Install today to build against the type surface.

## What Works Today

- Published npm packages with a stable import surface
- TypeScript types and interfaces for job planning, execution, and result handling
- Reference examples demonstrating expected integration patterns

## What Is Not Yet Shipped

- Runtime HTTP client or transport layer
- Production-ready client helpers for connecting to the OpenMerch network
- Polished self-serve integration guidance

## How It Works

Agents submit jobs by type. OpenMerch plans and routes execution to the right provider, returns structured results, and bills your account automatically.

Under the hood, OpenMerch routes jobs to providers via the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>. Agents never interact with MPP directly.

- `@openmerch/agent` is for agents that submit and track jobs.
- `@openmerch/provider` is for building execution backends on the OpenMerch network.

For implementation details, see the package READMEs and example projects.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@openmerch/agent`](./packages/agent) | [![npm](https://img.shields.io/npm/v/@openmerch/agent)](https://www.npmjs.com/package/@openmerch/agent) | Preview types for job submission and result handling |
| [`@openmerch/provider`](./packages/provider) | [![npm](https://img.shields.io/npm/v/@openmerch/provider)](https://www.npmjs.com/package/@openmerch/provider) | Preview types for job execution backends |

## Quick Start

### Agent

```bash
npm install @openmerch/agent
```

```ts
import { OpenMerchAgent } from "@openmerch/agent";

const agent = new OpenMerchAgent({
  baseUrl: "https://api.openmerch.dev",
  apiKey: process.env.OPENMERCH_API_KEY!,
});

// check cost before committing
const plan = await agent.planJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
});

// execute the job — cost accrues to your account
const job = await agent.executeJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
  max_cost: plan.estimated_cost.max_microcents,
  idempotency_key: `lead-acme-${Date.now()}`,
});

console.log(job.output);
console.log(job.cost);
```

> The runtime client is under active development. The published package currently exports TypeScript types. The example above shows the target integration surface.

#### Current Type Surface

```ts
import type { AgentConfig, TaskRequest } from "@openmerch/agent";

const task: TaskRequest = {
  serviceId: "my-service",
  mode: "sync",
  payload: { prompt: "Hello, world" },
};
```

### Execution Backend (Provider)

```bash
npm install @openmerch/provider
```

```ts
import type {
  ProviderConfig,
  ServiceDefinition,
  SyncHandler,
  ExecutionRequest,
  ExecutionResult,
} from "@openmerch/provider";

const service: ServiceDefinition = {
  id: "my-service",
  name: "My Service",
  description: "A service that does something useful",
  modes: ["sync"],
  pricing: { basePrice: "100", currency: "USD" },
};
```

## Examples

| Example | Description |
|---------|-------------|
| [`agent-basic`](./examples/agent-basic) | Basic agent job planning and execution (mocked, no network) |
| [`provider-echo`](./examples/provider-echo) | Minimal execution backend that echoes job payloads (mocked, no network) |

## Repo Layout

```
packages/
  agent/        @openmerch/agent SDK
  provider/     @openmerch/provider SDK
examples/
  agent-basic/     Runnable agent example
  provider-echo/   Runnable provider example
```

## Type Evolution

Types like `TaskRequest`, `ServiceQuery`, and `WalletBalance` reflect an earlier iteration of the SDK surface. These will be renamed to match the job-oriented API (e.g., `JobRequest`, `JobResult`) in an upcoming pre-1.0 release. No action needed today — the type shapes are stable.

## Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Type-check without emitting
npm run typecheck
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full development guidelines.

## Pre-1.0 Stability

These packages are versioned below 1.0. Before 1.0, minor releases may include breaking changes. See individual package READMEs for current scope.

## License

[MIT](./LICENSE)

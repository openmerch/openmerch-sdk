# OpenMerch SDK

[OpenMerch](https://openmerch.dev) is a job execution layer for AI agents. Agents submit jobs by type, get structured results back, and pay per job with usage-based billing.

Under the hood, OpenMerch routes jobs to providers via the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>. Agents never interact with MPP directly.

## Packages

| Package | Version | Status | Description |
|---------|---------|--------|-------------|
| [`@openmerch/agent`](./packages/agent) | [![npm](https://img.shields.io/npm/v/@openmerch/agent)](https://www.npmjs.com/package/@openmerch/agent) | **Runtime SDK** | HTTP client for job planning, execution, and billing |
| [`@openmerch/provider`](./packages/provider) | [![npm](https://img.shields.io/npm/v/@openmerch/provider)](https://www.npmjs.com/package/@openmerch/provider) | Preview types | TypeScript type contracts for execution backends |

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

See the [agent package README](./packages/agent) for full API reference.

### Execution Backend (Provider)

> **Preview** — `@openmerch/provider` exports TypeScript types and interfaces only. Runtime functionality is under development.

```bash
npm install @openmerch/provider
```

Use the types in your TypeScript files:

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
| [`agent-basic`](./examples/agent-basic) | V1 SDK type surface demo (mocked, no network) |
| [`provider-echo`](./examples/provider-echo) | Minimal execution backend that echoes job payloads (mocked, no network) |

## Repo Layout

```
packages/
  agent/        @openmerch/agent — runtime SDK
  provider/     @openmerch/provider — preview types
examples/
  agent-basic/     Runnable agent example
  provider-echo/   Runnable provider example
```

## Migration from Preview Types

The `@openmerch/agent` package previously exported preview type contracts (`TaskRequest`, `ServiceQuery`, `WalletBalance`, etc.). These have been replaced by the V1 runtime SDK as a pre-1.0 breaking reset.

| Old (removed) | New |
|---|---|
| `TaskRequest` | `ExecuteJobRequest` |
| `TaskResult` | `JobResponse` |
| `ServiceQuery` / `ServiceListing` | `getCatalog()` / `planJob()` |
| `WalletBalance` | Card-on-file billing via `getBillingConfig()` |
| `AgentConfig` (types-only) | `AgentConfig` (runtime — passed to `new OpenMerchAgent()`) |

## Development

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all packages and examples
npm run typecheck    # Type-check all workspaces (no emit)
npm run test         # Run tests across all workspaces
npm run clean        # Remove build artifacts
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full development guidelines.

## Pre-1.0 Stability

These packages are versioned below 1.0. Before 1.0, minor releases may include breaking changes. See individual package READMEs for current scope.

## License

[MIT](./LICENSE)

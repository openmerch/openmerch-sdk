# @openmerch/agent

Runtime SDK for submitting and tracking jobs on the [OpenMerch](https://openmerch.dev) platform. Plan costs, execute jobs, poll for results, and manage billing — all from TypeScript.

Zero runtime dependencies. Uses `node:http`/`node:https` directly. Requires Node.js 18+.

## Installation

```bash
npm install @openmerch/agent
```

## Quick Start

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

## Configuration

```ts
const agent = new OpenMerchAgent({
  baseUrl: "https://api.openmerch.dev",
  apiKey: "om_live_...",

  // Retry settings
  retries: 2,              // default: 0 (no retry)
  retryBaseMs: 500,        // default: 500
  retryMaxMs: 10000,       // default: 10000
  timeoutMs: 30000,        // default: 30000

  // MPP payment handlers (optional)
  paymentHandlers: [],
  preferredMethods: [],
  maxPaymentRetries: 3,    // default: 3
});
```

## V1 Job API

### `getCatalog()`

List all available job types.

```ts
const catalog = await agent.getCatalog();
```

### `planJob(request)`

Get a cost estimate and feasibility check before executing.

```ts
const plan = await agent.planJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
});
// plan.estimated_cost.max_microcents, plan.can_execute, plan.confidence
```

### `executeJob(request)`

Execute a job. Cost accrues to your account.

```ts
const job = await agent.executeJob({
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
  max_cost: 250000,
  idempotency_key: `lead-acme-${Date.now()}`,
});
// job.job_id, job.status, job.output, job.cost
```

### `getJob(jobId)`

Check the current state of a job.

```ts
const job = await agent.getJob("job_01HXK9...");
```

### `cancelJob(jobId)`

Cancel a running job.

```ts
const result = await agent.cancelJob("job_01HXK9...");
```

### `listJobs(options?)`

List jobs with optional filters and cursor-based pagination.

```ts
const list = await agent.listJobs({
  status: "completed",
  job_type: "lead_qualification_v1",
  limit: 10,
});
// list.jobs, list.next_cursor, list.has_more
```

### `pollJob(jobId, intervalMs?, timeoutMs?)`

Poll a job until it reaches a terminal state (`completed`, `failed`, `cancelled`).

```ts
const result = await agent.pollJob("job_01HXK9...", 1000, 300000);
```

## Billing

Jobs are billed to your card on file. Cost values are in microcents (1 USD = 1,000,000 microcents).

```ts
// Get Stripe publishable key for client-side setup
const config = await agent.getBillingConfig();

// Create a SetupIntent for card enrollment
const intent = await agent.createCardSetupIntent();

// Confirm after Stripe.js confirmCardSetup succeeds
const card = await agent.confirmCardSetup(intent.setup_intent_id);

// List cards on file
const { cards } = await agent.listCards();
```

## MPP Payment Handlers

For providers that use the [Machine Payable Protocol](https://mpp.dev/), you can configure payment handlers that automatically negotiate 402 challenges:

```ts
const agent = new OpenMerchAgent({
  baseUrl: "https://api.openmerch.dev",
  apiKey: "om_live_...",
  paymentHandlers: [
    {
      method: "tempo",
      pay: async (challenge) => {
        // Execute payment, return credential string
        return "credential_string";
      },
    },
  ],
  preferredMethods: ["tempo"],
});
```

## Error Handling

```ts
import { OpenMerchAgent, OpenMerchError, PaymentRequiredError, NoMatchingMethodError } from "@openmerch/agent";

try {
  const job = await agent.executeJob({ ... });
} catch (err) {
  if (err instanceof OpenMerchError) {
    console.error(err.statusCode, err.responseBody);
  }
  if (err instanceof PaymentRequiredError) {
    console.error("No payment handlers configured", err.challenges);
  }
  if (err instanceof NoMatchingMethodError) {
    console.error("No handler matches offered methods", err.challenges);
  }
}
```

## Deprecated V0 Methods

The following methods are still exported but deprecated. Use the V1 Job API instead.

| V0 Method | V1 Replacement |
|---|---|
| `discover()` | `getCatalog()` / `planJob()` |
| `execute()` | `executeJob()` |
| `executeStream()` | Not available in V1 |
| `getExecution()` | `getJob()` |
| `cancelExecution()` | `cancelJob()` |
| `pollExecution()` | `pollJob()` |
| `runTask()` | `planJob()` + `executeJob()` |
| `getWallet()` / `fund()` | Card-on-file billing |

## Exported Types

```ts
import type {
  AgentConfig,
  PlanJobRequest,
  PlanJobResponse,
  CostEstimate,
  ExecuteJobRequest,
  JobResponse,
  JobCost,
  JobError,
  CancelJobResponse,
  ListJobsOptions,
  JobListItem,
  JobListResponse,
  CatalogEntry,
  PaymentHandler,
  MPPChallenge,
  BillingConfig,
  SetupIntentResult,
  CardInfo,
  CardListResponse,
} from "@openmerch/agent";
```

## Pre-1.0 Stability

This package is versioned below 1.0. Before 1.0, minor releases may include breaking changes.

## License

[MIT](../../LICENSE)

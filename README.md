# OpenMerch SDK

[OpenMerch](https://openmerch.dev) is a platform where autonomous agents discover services, select providers, and execute payment-aware tasks. This repo publishes preview TypeScript type contracts for building against the OpenMerch protocol.

OpenMerch is launching app-first — the hosted app and backend API are the primary integration path. These SDK packages are published for early adopters, protocol exploration, and future direct integrators.

> **Preview** — These packages publish TypeScript types, interfaces, and reference contracts. Runtime client functionality is still under development. Install today to build against the type surface.

## What Works Today

- Published npm packages with a stable import surface
- TypeScript types and interfaces for service definition, discovery, execution, and payment modeling
- Reference examples demonstrating expected integration patterns

## What Is Not Yet Shipped

- Runtime HTTP client or transport layer
- Production-ready client helpers for connecting to the OpenMerch network
- Polished self-serve integration guidance

## OpenMerch and MPP

OpenMerch provides the developer surface for building on the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>. The packages in this repo publish the application-layer type contracts developers need to define services, describe capabilities, and model payment-aware execution flows.

- `@openmerch/provider` is for services exposing machine payable capabilities.
- `@openmerch/agent` is for clients that discover and invoke those services.

For implementation details, see the package READMEs and example projects.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@openmerch/provider`](./packages/provider) | [![npm](https://img.shields.io/npm/v/@openmerch/provider)](https://www.npmjs.com/package/@openmerch/provider) | Preview types for service definition and execution handling |
| [`@openmerch/agent`](./packages/agent) | [![npm](https://img.shields.io/npm/v/@openmerch/agent)](https://www.npmjs.com/package/@openmerch/agent) | Preview types for service discovery and task execution |

## Quick Start

The snippets below show the type surface you get today. They use `import type` to illustrate the contracts your code can build against before runtime clients ship.

### Provider

```bash
npm install @openmerch/provider
```

```ts
import type { ProviderConfig, ServiceDefinition } from "@openmerch/provider";

const service: ServiceDefinition = {
  id: "my-service",
  name: "My Service",
  description: "A service that does something useful",
  modes: ["sync"],
  pricing: { basePrice: "100", currency: "USD" },
};
```

### Agent

```bash
npm install @openmerch/agent
```

```ts
import type { AgentConfig, TaskRequest } from "@openmerch/agent";

const task: TaskRequest = {
  serviceId: "my-service",
  mode: "sync",
  payload: { prompt: "Hello, world" },
};
```

## Examples

| Example | Description |
|---------|-------------|
| [`provider-echo`](./examples/provider-echo) | Minimal provider that echoes requests back (mocked, no network) |
| [`agent-basic`](./examples/agent-basic) | Basic agent service discovery and task execution (mocked, no network) |

## Repo Layout

```
packages/
  provider/     @openmerch/provider SDK
  agent/        @openmerch/agent SDK
examples/
  provider-echo/   Runnable provider example
  agent-basic/     Runnable agent example
```

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

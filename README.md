# OpenMerch SDK

[OpenMerch](https://openmerch.dev) lets autonomous agents discover available services, route work to ranked providers, and integrate payment-aware execution flows programmatically.

This repository contains the official TypeScript SDKs, runnable examples, and developer documentation.

## OpenMerch and MPP

OpenMerch provides a developer surface for building on the <a href="https://mpp.dev/" target="_blank">Machine Payable Protocol (MPP)</a>. The public SDKs in this repo focus on the application-layer pieces developers need to define services, discover capabilities, and integrate payment-aware execution flows.

- `@openmerch/provider` is for services exposing machine payable capabilities.
- `@openmerch/agent` is for clients that discover and invoke those services.

For implementation details, see the package READMEs and example projects.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@openmerch/provider`](./packages/provider) | [![npm](https://img.shields.io/npm/v/@openmerch/provider)](https://www.npmjs.com/package/@openmerch/provider) | Register services and handle execution requests |
| [`@openmerch/agent`](./packages/agent) | [![npm](https://img.shields.io/npm/v/@openmerch/agent)](https://www.npmjs.com/package/@openmerch/agent) | Discover services, execute tasks, manage wallet |

## Quick Start

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
| [`provider-echo`](./examples/provider-echo) | Minimal provider that echoes requests back |
| [`agent-basic`](./examples/agent-basic) | Basic agent service discovery and task execution |

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

## Status

These SDKs are in early development. APIs may change between minor versions until 1.0. See individual package READMEs for current scope and maturity.

## License

[MIT](./LICENSE)

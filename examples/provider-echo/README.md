# Provider Echo Example (internal / legacy)

> **Internal / legacy — not part of the current public SDK surface.**
>
> Provider integrations on OpenMerch are currently operator-managed. This example exists only as a reference for the internal `@openmerch/provider` type contracts and is not intended for external developers building against OpenMerch.
>
> If you are building an agent, see [`examples/agent-basic`](../agent-basic) instead.

## Run

```bash
# From the repo root
npm install
npm run build

# Run the example
cd examples/provider-echo
npm start
```

## What It Does

1. Defines an echo service with sync and stream execution modes
2. Implements handler functions that satisfy the internal type contracts
3. Demonstrates how a provider would process incoming job execution requests

The output is printed to the console — no network connection required.

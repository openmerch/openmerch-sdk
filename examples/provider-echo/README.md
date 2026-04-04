# Provider Echo Example

A minimal example showing how to define an OpenMerch provider service and implement execution handlers using the `@openmerch/provider` types.

This example runs locally and does not connect to the OpenMerch network. It demonstrates the type contracts that a real provider implementation would satisfy.

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
2. Implements handler functions that satisfy the SDK type contracts
3. Demonstrates how a provider would process incoming execution requests

The output is printed to the console — no network connection required.

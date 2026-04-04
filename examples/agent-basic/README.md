# Agent Basic Example

A minimal example showing how to use the `@openmerch/agent` types for service discovery, task execution, and wallet inspection.

This example runs locally with mocked data and does not connect to the OpenMerch network. It demonstrates the type contracts that a real agent client would use.

## Run

```bash
# From the repo root
npm install
npm run build

# Run the example
cd examples/agent-basic
npm start
```

## What It Does

1. Builds a service discovery query using `ServiceQuery`
2. Works with mock service listings matching `ServiceListing`
3. Constructs a task request using `TaskRequest`
4. Shows a mock task result and wallet balance

The output is printed to the console — no network connection required.

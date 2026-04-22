# Agent Basic Example

A minimal example showing how to use the `@openmerch/agent` types for job planning, execution, and result handling.

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

1. Constructs a job execution request using `TaskRequest`
2. Shows a mock job result matching `TaskResult`
3. Demonstrates execution mode selection (sync, async, streaming)

The output is printed to the console — no network connection required.

# Agent Basic Example

A minimal example showing how to use the `@openmerch/agent` types for job planning, execution, and result handling.

This example runs locally with mocked data and does not connect to the OpenMerch network. It demonstrates the type contracts that a real agent client would use.

## Run

Clone and run — no prior setup needed:

```bash
git clone --depth 1 https://github.com/openmerch/openmerch-sdk.git
cd openmerch-sdk/examples/agent-basic
npm install && npm run build && npm start | less +G
```

If you already have the repo cloned:

```bash
# From repo root
npm install && npm run build
cd examples/agent-basic && npm start | less +G
```

> **Navigating the Terminal output:** Press `g` to jump to the top, `G` to jump to the bottom, `q` to quit.

## What It Does

1. Constructs a job execution request using `TaskRequest`
2. Shows a mock job result matching `TaskResult`
3. Demonstrates execution mode selection (sync, async, streaming)

The output is printed to the console — no network connection required.

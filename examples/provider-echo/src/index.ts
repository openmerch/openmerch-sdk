/**
 * Provider Echo Example
 *
 * Demonstrates how to define services and implement execution handlers
 * using the @openmerch/provider type contracts. Runs locally without
 * connecting to the OpenMerch network.
 */

import type {
  ServiceDefinition,
  ExecutionRequest,
  ExecutionResult,
  StreamChunk,
  SyncHandler,
  StreamHandler,
} from "@openmerch/provider";

// ---------------------------------------------------------------------------
// 1. Define a service
// ---------------------------------------------------------------------------

const echoService: ServiceDefinition = {
  id: "echo",
  name: "Echo Service",
  description: "Returns the input payload unchanged",
  modes: ["sync", "stream"],
  pricing: {
    basePrice: "0",
    currency: "USD",
  },
};

// ---------------------------------------------------------------------------
// 2. Implement handlers
// ---------------------------------------------------------------------------

const handleSync: SyncHandler = async (req) => {
  const result: ExecutionResult = {
    requestId: req.requestId,
    success: true,
    data: req.payload,
  };
  return result;
};

const handleStream: StreamHandler = async (req, emit) => {
  const text = typeof req.payload === "string" ? req.payload : JSON.stringify(req.payload);
  const words = text.split(" ");

  for (let i = 0; i < words.length; i++) {
    emit({
      index: i,
      data: words[i],
      done: i === words.length - 1,
    } satisfies StreamChunk);
  }
};

// ---------------------------------------------------------------------------
// 3. Simulate execution
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Service: ${echoService.name}`);
  console.log(`Modes:   ${echoService.modes.join(", ")}`);
  console.log();

  // Simulate a sync request
  const syncRequest: ExecutionRequest = {
    requestId: "req-001",
    serviceId: echoService.id,
    mode: "sync",
    payload: { message: "Hello from the echo provider" },
  };

  console.log("--- Sync Execution ---");
  const syncResult = await handleSync(syncRequest);
  console.log("Result:", JSON.stringify(syncResult, null, 2));
  console.log();

  // Simulate a streaming request
  const streamRequest: ExecutionRequest = {
    requestId: "req-002",
    serviceId: echoService.id,
    mode: "stream",
    payload: "streaming these words one at a time",
  };

  console.log("--- Stream Execution ---");
  await handleStream(streamRequest, (chunk) => {
    console.log(`  [chunk ${chunk.index}] ${JSON.stringify(chunk.data)}${chunk.done ? " (done)" : ""}`);
  });
}

main().catch(console.error);

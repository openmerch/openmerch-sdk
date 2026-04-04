/**
 * Agent Basic Example
 *
 * Demonstrates service discovery, task execution, and wallet types
 * using the @openmerch/agent type contracts. Runs locally with mocked
 * data — no network connection required.
 */

import type {
  ServiceQuery,
  ServiceListing,
  ServiceQueryResult,
  TaskRequest,
  TaskResult,
  WalletBalance,
} from "@openmerch/agent";

// ---------------------------------------------------------------------------
// 1. Service discovery
// ---------------------------------------------------------------------------

const query: ServiceQuery = {
  keyword: "echo",
  mode: "sync",
  maxPrice: "100",
  currency: "USD",
  limit: 10,
};

// Mock: in a real agent, this would come from the OpenMerch network
const mockListings: ServiceListing[] = [
  {
    serviceId: "echo",
    providerId: "provider-001",
    name: "Echo Service",
    description: "Returns the input payload unchanged",
    modes: ["sync", "stream"],
    pricing: { basePrice: "0", currency: "USD" },
  },
  {
    serviceId: "translate-v1",
    providerId: "provider-002",
    name: "Translation Service",
    description: "Translates text between languages",
    modes: ["sync"],
    pricing: { basePrice: "50", currency: "USD" },
  },
];

const discoveryResult: ServiceQueryResult = {
  services: mockListings,
  total: mockListings.length,
  offset: 0,
  limit: query.limit ?? 10,
};

// ---------------------------------------------------------------------------
// 2. Task execution
// ---------------------------------------------------------------------------

const selectedService = discoveryResult.services[0];

const task: TaskRequest = {
  serviceId: selectedService.serviceId,
  mode: "sync",
  payload: { message: "Hello from the agent" },
  maxPrice: "100",
};

// Mock: in a real agent, this would be the response from the provider
const taskResult: TaskResult = {
  taskId: "task-001",
  success: true,
  data: { message: "Hello from the agent" },
  cost: { amount: "0", currency: "USD" },
};

// ---------------------------------------------------------------------------
// 3. Wallet
// ---------------------------------------------------------------------------

// Mock wallet balance
const balance: WalletBalance = {
  available: "10000",
  pending: "0",
  currency: "USD",
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function main() {
  console.log("=== Service Discovery ===");
  console.log(`Query: keyword="${query.keyword}", mode=${query.mode}`);
  console.log(`Found ${discoveryResult.total} service(s):`);
  for (const svc of discoveryResult.services) {
    console.log(`  - ${svc.name} (${svc.serviceId}) — ${svc.pricing.basePrice} ${svc.pricing.currency}`);
  }
  console.log();

  console.log("=== Task Execution ===");
  console.log(`Service: ${task.serviceId}, Mode: ${task.mode}`);
  console.log(`Result:  success=${taskResult.success}, cost=${taskResult.cost?.amount} ${taskResult.cost?.currency}`);
  console.log(`Data:    ${JSON.stringify(taskResult.data)}`);
  console.log();

  console.log("=== Wallet ===");
  console.log(`Available: ${balance.available} ${balance.currency}`);
  console.log(`Pending:   ${balance.pending} ${balance.currency}`);
}

main();

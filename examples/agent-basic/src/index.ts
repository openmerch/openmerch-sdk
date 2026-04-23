/**
 * Agent Basic Example
 *
 * Demonstrates the V1 SDK type surface using the @openmerch/agent package.
 * This example constructs typed request/response objects offline to show
 * the API shape — it does not exercise real HTTP transport behavior.
 */

import {
  OpenMerchAgent,
} from "@openmerch/agent";
import type {
  AgentConfig,
  PlanJobRequest,
  PlanJobResponse,
  CostEstimate,
  ExecuteJobRequest,
  JobResponse,
  JobCost,
} from "@openmerch/agent";

// ---------------------------------------------------------------------------
// 1. Configuration
// ---------------------------------------------------------------------------

const config: AgentConfig = {
  baseUrl: "https://api.openmerch.dev",
  apiKey: "om_live_example_key",
};

const agent = new OpenMerchAgent(config);
console.log("=== Agent Configuration ===");
console.log(`Endpoint: ${config.baseUrl}`);
console.log(`Agent created: ${agent instanceof OpenMerchAgent}`);
console.log();

// ---------------------------------------------------------------------------
// 2. Plan a job (typed request + mocked response)
// ---------------------------------------------------------------------------

const planRequest: PlanJobRequest = {
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
};

const mockPlanResponse: PlanJobResponse = {
  job_type: "lead_qualification_v1",
  can_execute: true,
  estimated_cost: {
    min_microcents: 150000,
    max_microcents: 250000,
    currency: "USD",
  },
  confidence: 0.95,
  estimated_latency_ms: 3200,
  candidate_count: 3,
  routing_strategy: "cost_optimized",
};

console.log("=== Plan Job ===");
console.log(`Job type: ${planRequest.job_type}`);
console.log(`Can execute: ${mockPlanResponse.can_execute}`);
console.log(`Estimated cost: ${mockPlanResponse.estimated_cost.min_microcents}–${mockPlanResponse.estimated_cost.max_microcents} microcents`);
console.log(`Confidence: ${mockPlanResponse.confidence}`);
console.log();

// ---------------------------------------------------------------------------
// 3. Execute a job (typed request + mocked response)
// ---------------------------------------------------------------------------

const executeRequest: ExecuteJobRequest = {
  job_type: "lead_qualification_v1",
  input: { domain: "acme.com" },
  max_cost: mockPlanResponse.estimated_cost.max_microcents,
  idempotency_key: `lead-acme-example`,
};

const mockJobResponse: JobResponse = {
  job_id: "job_01HXK9QVBN3M4RPYG2WJKFZ8",
  job_type: "lead_qualification_v1",
  status: "completed",
  output: {
    domain: "acme.com",
    qualified: true,
    score: 87,
    signals: ["enterprise", "high_traffic", "active_hiring"],
  },
  cost: {
    total_microcents: 200000,
    currency: "USD",
  },
  created_at: "2025-01-15T10:30:00Z",
  updated_at: "2025-01-15T10:30:03Z",
};

console.log("=== Execute Job ===");
console.log(`Job ID: ${mockJobResponse.job_id}`);
console.log(`Status: ${mockJobResponse.status}`);
console.log(`Cost: ${mockJobResponse.cost.total_microcents} microcents (${mockJobResponse.cost.currency})`);
console.log(`Output: ${JSON.stringify(mockJobResponse.output)}`);

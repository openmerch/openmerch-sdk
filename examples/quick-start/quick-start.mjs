#!/usr/bin/env node
import { randomUUID } from "node:crypto";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: OPENMERCH_API_KEY=om_live_... node quick-start.mjs <domain>");
  console.error("Example: node quick-start.mjs acme.com");
  process.exit(1);
}

const apiKey = process.env.OPENMERCH_API_KEY;
if (!apiKey) {
  console.error("Error: OPENMERCH_API_KEY environment variable is required.");
  console.error("  export OPENMERCH_API_KEY=om_live_...");
  process.exit(1);
}

const BASE_URL = (process.env.OPENMERCH_BASE_URL ?? "https://api.openmerch.dev").replace(/\/$/, "");
const JOB_TYPE = "company_enrichment_v1";

async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const url = `${BASE_URL}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "X-OpenMerch-Key": apiKey, ...headers },
      body,
    });
  } catch (err) {
    console.error(`Error: Network request failed for ${path}: ${err.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    let detail = "";
    try { detail = ` — ${await res.text()}`; } catch {}
    console.error(`Error: ${method} ${path} returned HTTP ${res.status}${detail}`);
    process.exit(1);
  }
  return res.json();
}

// Validate product-contract job type exists in catalog
const catalog = await apiFetch("/v1/catalog");
if (!Array.isArray(catalog) || !catalog.some((e) => e.job_type === JOB_TYPE)) {
  const available = Array.isArray(catalog) ? catalog.map((e) => e.job_type).join(", ") : "(unreadable)";
  console.error(`Error: Job type "${JOB_TYPE}" not found in catalog.`);
  console.error(`Available job types: ${available}`);
  process.exit(1);
}

// Plan
const plan = await apiFetch("/v1/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ job_type: JOB_TYPE, input: { company_domain: domain } }),
});

if (!plan.can_execute) {
  console.error(`Error: No providers available for job type "${JOB_TYPE}" with domain "${domain}".`);
  process.exit(1);
}

// Determine max cost — prefer server-quoted price, fall back to plan estimate
const rawCost = plan.quoted_customer_price_microcents ?? plan.estimated_cost?.max_microcents;
if (!Number.isFinite(rawCost) || rawCost <= 0) {
  console.error(`Error: Could not determine a valid max_cost from plan response. Got: ${JSON.stringify(rawCost)}`);
  process.exit(1);
}

// Execute
const idempotencyKey = randomUUID();
let job = await apiFetch("/v1/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    job_type: JOB_TYPE,
    input: { company_domain: domain },
    max_cost: rawCost,
    idempotency_key: idempotencyKey,
  }),
});

// Poll if the job is still executing
if (job.status === "executing") {
  console.log(`Polling job ${job.job_id}...`);
  const MAX_ATTEMPTS = 60;
  let attempts = 0;
  while (job.status === "executing" && attempts < MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, 1000));
    job = await apiFetch(`/v1/jobs/${job.job_id}`);
    attempts++;
  }
  if (job.status === "executing") {
    console.error(`Error: Job ${job.job_id} timed out after ${MAX_ATTEMPTS}s.`);
    process.exit(1);
  }
}

if (job.status === "failed") {
  console.error(`Error: Job failed — ${job.error?.message ?? "unknown error"}`);
  process.exit(1);
}

if (job.status === "cancelled") {
  console.error(`Error: Job ${job.job_id} was cancelled.`);
  process.exit(1);
}

const costUSD = (job.cost.total_microcents / 1_000_000).toFixed(4);
console.log("\n=== Result ===");
console.log(JSON.stringify(job.output, null, 2));
console.log(`\nCost:   $${costUSD} USD`);
console.log(`Job ID: ${job.job_id}`);

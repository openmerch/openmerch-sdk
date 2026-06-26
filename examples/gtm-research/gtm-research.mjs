#!/usr/bin/env node
import { randomUUID } from "node:crypto";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: OPENMERCH_API_KEY=om_live_... node gtm-research.mjs <domain> [keywords]");
  console.error("Example: node gtm-research.mjs amazon.com 'director VP'");
  process.exit(1);
}

const keywords = process.argv[3] ?? "director VP";

const apiKey = process.env.OPENMERCH_API_KEY;
if (!apiKey) {
  console.error("Error: OPENMERCH_API_KEY environment variable is required.");
  console.error("  export OPENMERCH_API_KEY=om_live_...");
  process.exit(1);
}

const BASE_URL = (process.env.OPENMERCH_BASE_URL ?? "https://api.openmerch.dev").replace(/\/$/, "");
const COMPANY_JOB_TYPE = "company_enrichment_v1";
const CONTACTS_PREFERRED = [
  "people_enrichment_v1",
  "people_search_v1",
  "contact_enrichment_v1",
  "contact_search_v1",
];
const CONTACTS_STEMS = [
  "people_enrichment",
  "people_search",
  "contact_enrichment",
  "contact_search",
];

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

async function planAndExecute(jobType, input, label) {
  const plan = await apiFetch("/v1/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_type: jobType, input }),
  });

  if (!plan.can_execute) {
    console.error(`Error: ${label} — no providers available (can_execute=false).`);
    process.exit(1);
  }

  const rawCost = plan.quoted_customer_price_microcents ?? plan.estimated_cost?.max_microcents;
  if (!Number.isFinite(rawCost) || rawCost <= 0) {
    console.error(`Error: ${label} — could not determine a valid max_cost. Got: ${JSON.stringify(rawCost)}`);
    process.exit(1);
  }

  let job = await apiFetch("/v1/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_type: jobType,
      input,
      max_cost: rawCost,
      idempotency_key: randomUUID(),
    }),
  });

  if (job.status === "executing") {
    console.log(`  Polling ${label} job ${job.job_id}...`);
    const MAX_ATTEMPTS = 60;
    let attempts = 0;
    while (job.status === "executing" && attempts < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1000));
      job = await apiFetch(`/v1/jobs/${job.job_id}`);
      attempts++;
    }
    if (job.status === "executing") {
      console.error(`Error: ${label} job ${job.job_id} timed out after ${MAX_ATTEMPTS}s.`);
      process.exit(1);
    }
  }

  if (job.status === "failed") {
    console.error(`Error: ${label} job failed — ${job.error?.message ?? "unknown error"}`);
    process.exit(1);
  }

  if (job.status === "cancelled") {
    console.error(`Error: ${label} job ${job.job_id} was cancelled.`);
    process.exit(1);
  }

  return job;
}

// Resolve catalog job types
const catalog = await apiFetch("/v1/catalog");
if (!Array.isArray(catalog) || !catalog.some((e) => e.job_type === COMPANY_JOB_TYPE)) {
  const available = Array.isArray(catalog) ? catalog.map((e) => e.job_type).join(", ") : "(unreadable)";
  console.error(`Error: Job type "${COMPANY_JOB_TYPE}" not found in catalog.`);
  console.error(`Available: ${available}`);
  process.exit(1);
}

let contactsJobType = null;
for (const name of CONTACTS_PREFERRED) {
  if (catalog.some((e) => e.job_type === name)) { contactsJobType = name; break; }
}
if (!contactsJobType) {
  const matches = catalog.filter((e) => CONTACTS_STEMS.some((s) => e.job_type.includes(s)));
  if (matches.length === 1) {
    contactsJobType = matches[0].job_type;
  } else {
    const available = catalog.map((e) => e.job_type).join(", ");
    const msg = matches.length === 0
      ? `None of the preferred contacts job types found in catalog.`
      : `Ambiguous contacts job type — multiple matches: ${matches.map((e) => e.job_type).join(", ")}.`;
    console.error(`Error: ${msg}\n  Preferred: ${CONTACTS_PREFERRED.join(", ")}\n  Available: ${available}`);
    process.exit(1);
  }
}

// Step 1: Company enrichment
console.log(`\nFetching company data for ${domain}...`);
const companyJob = await planAndExecute(
  COMPANY_JOB_TYPE,
  { company_domain: domain },
  "Company enrichment",
);

// Step 2: People search
console.log(`Searching for "${keywords}" contacts at ${domain}...`);
const contactsJob = await planAndExecute(
  contactsJobType,
  {
    operation: "people-search",
    q_organization_domains: [domain],
    q_keywords: keywords,
    per_page: 25,
    page: 1,
  },
  "Contacts",
);

// Print summary
const fmt = (microcents) => `$${(microcents / 10_000_000).toFixed(4)} USD`;

console.log("\n=== Company ===");
console.log(JSON.stringify(companyJob.output, null, 2));
console.log(`Cost: ${fmt(companyJob.cost.total_microcents)}  Job: ${companyJob.job_id}`);

console.log("\n=== Contacts ===");
console.log(JSON.stringify(contactsJob.output, null, 2));
console.log(`Cost: ${fmt(contactsJob.cost.total_microcents)}  Job: ${contactsJob.job_id}`);

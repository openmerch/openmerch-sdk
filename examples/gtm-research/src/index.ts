import { OpenMerchAgent } from "@openmerch/agent";
import type { JobResponse } from "@openmerch/agent";
import { randomUUID } from "node:crypto";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: npm start -- <domain>");
  console.error("Example: npm start -- acme.com");
  process.exit(1);
}

const apiKey = process.env.OPENMERCH_API_KEY;
if (!apiKey) {
  console.error("Error: OPENMERCH_API_KEY environment variable is required.");
  console.error("  export OPENMERCH_API_KEY=om_live_...");
  process.exit(1);
}

const baseUrl = (process.env.OPENMERCH_BASE_URL ?? "https://api.openmerch.dev").replace(/\/$/, "");

const agent = new OpenMerchAgent({ baseUrl, apiKey });

function resolveJobType(
  catalog: { job_type: string }[],
  preferred: string[],
  stems: string[],
  label: string,
): string {
  for (const name of preferred) {
    if (catalog.some((e) => e.job_type === name)) return name;
  }
  const matches = catalog.filter((e) => stems.some((s) => e.job_type.includes(s)));
  const candidateList = catalog.map((e) => e.job_type).join(", ");
  if (matches.length === 1) return matches[0].job_type;
  if (matches.length === 0) {
    throw new Error(
      `Cannot find ${label} job type in catalog.\n` +
        `  Preferred: ${preferred.join(", ")}\n` +
        `  Available: ${candidateList}`,
    );
  }
  throw new Error(
    `Ambiguous ${label} job type — multiple matches: ${matches.map((e) => e.job_type).join(", ")}.\n` +
      `  Add one of the preferred names to resolve: ${preferred.join(", ")}`,
  );
}

function formatUSD(microcents: number): string {
  return `$${(microcents / 1_000_000).toFixed(4)} USD`;
}

async function runJob(
  jobType: string,
  input: Record<string, unknown>,
  label: string,
): Promise<JobResponse> {
  const plan = await agent.planJob({ job_type: jobType, input });
  if (!plan.can_execute) {
    throw new Error(`${label}: plan returned can_execute=false — no providers available.`);
  }

  let job = await agent.executeJob({
    job_type: jobType,
    input,
    max_cost:
      (plan as typeof plan & { quoted_customer_price_microcents?: number })
        .quoted_customer_price_microcents ?? plan.estimated_cost.max_microcents,
    idempotency_key: randomUUID(),
  });

  if (job.status === "executing") {
    job = await agent.pollJob(job.job_id);
  }

  if (job.status === "failed") {
    throw new Error(`${label} job failed — ${job.error?.message ?? "unknown error"}`);
  }

  if (job.status === "cancelled") {
    throw new Error(`${label} job was cancelled.`);
  }

  return job;
}

const catalog = await agent.getCatalog();

const companyJobType = resolveJobType(
  catalog,
  ["company_enrichment_v1"],
  ["company_enrichment"],
  "company enrichment",
);

const contactsJobType = resolveJobType(
  catalog,
  ["people_enrichment_v1", "people_search_v1", "contact_enrichment_v1", "contact_search_v1"],
  ["people_enrichment", "people_search", "contact_enrichment", "contact_search"],
  "contacts",
);

// Step 1: Company enrichment
console.log(`\nFetching company data for ${domain}...`);
const companyJob = await runJob(companyJobType, { company_domain: domain }, "Company enrichment");

// Step 2: Contacts — pass company name from step 1 if available
const companyOutput = companyJob.output as Record<string, unknown> | null | undefined;
const companyName =
  typeof companyOutput?.name === "string"
    ? companyOutput.name
    : typeof companyOutput?.company_name === "string"
    ? companyOutput.company_name
    : undefined;

console.log(`Fetching contacts for ${domain}${companyName ? ` (${companyName})` : ""}...`);
const contactsJob = await runJob(
  contactsJobType,
  {
    company_domain: domain,
    ...(companyName ? { company_name: companyName } : {}),
  },
  "Contacts",
);

// Print summary
console.log("\n=== Company ===");
console.log(JSON.stringify(companyJob.output, null, 2));
console.log(`Cost: ${formatUSD(companyJob.cost.total_microcents)}  Job: ${companyJob.job_id}`);

console.log("\n=== Contacts ===");
console.log(JSON.stringify(contactsJob.output, null, 2));
console.log(`Cost: ${formatUSD(contactsJob.cost.total_microcents)}  Job: ${contactsJob.job_id}`);

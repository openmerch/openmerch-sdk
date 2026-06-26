# gtm-research

A TypeScript SDK example that runs two sequential enrichment jobs — company data first, then contacts — against the live OpenMerch API.

This is the pattern a research agent uses: submit typed data jobs and get structured results back, without stitching together multiple data providers.

## Prerequisites

- Node.js 18+
- An OpenMerch API key (`om_live_...`)

## Run

```bash
# From the repo root
npm install
npm run build

# Then run the example
cd examples/gtm-research
export OPENMERCH_API_KEY=om_live_your_key_here
npm start -- acme.com
```

Use `OPENMERCH_BASE_URL` to point at a different environment:

```bash
OPENMERCH_BASE_URL=https://api.openmerch.dev npm start -- acme.com
```

## What It Does

1. Discovers available job types from the live catalog
2. Runs a company enrichment job for the given domain
3. Runs a contacts job, passing the company name from step 1 where relevant
4. Prints a summary of both results with cost and job ID

## Sample Output

<!-- Sample output will vary based on the domain and live data.
     Run the script with a real API key to see actual results.

Fetching company data for acme.com...
Fetching contacts for acme.com (Acme Corp)...

=== Company ===
{
  "company_name": "Acme Corp",
  "industry": "Software",
  ...
}
Cost: $0.0200 USD  Job: job_01HXK9QVBN3M4RPYG2WJKFZ8

=== Contacts ===
[
  { "name": "Jane Smith", "title": "VP Engineering", ... },
  ...
]
Cost: $0.0350 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZ9
-->

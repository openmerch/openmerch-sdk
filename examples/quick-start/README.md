# quick-start

A zero-dependency script that runs a live company enrichment job against the OpenMerch API. No `npm install` needed — just Node 18+ and an API key.

## Prerequisites

- Node.js 18+
- An OpenMerch API key (`om_live_...`)

## Run

```bash
export OPENMERCH_API_KEY=om_live_your_key_here
node quick-start.mjs acme.com
```

Or inline:

```bash
OPENMERCH_API_KEY=om_live_... node quick-start.mjs acme.com
```

Use `OPENMERCH_BASE_URL` to point at a different environment:

```bash
OPENMERCH_BASE_URL=https://api.openmerch.dev OPENMERCH_API_KEY=om_live_... node quick-start.mjs acme.com
```

## What It Does

1. Validates `company_enrichment_v1` is available in the live catalog
2. Plans the job to get a cost estimate
3. Executes the job (polls until complete if the job runs async)
4. Prints the output, cost in USD, and job ID

## Sample Output

<!-- Sample output will vary based on the domain and live data.
     Run the script with a real API key to see actual results.

=== Result ===
{
  "company_name": "Acme Corp",
  "industry": "Software",
  ...
}

Cost:   $0.0200 USD
Job ID: job_01HXK9QVBN3M4RPYG2WJKFZ8
-->

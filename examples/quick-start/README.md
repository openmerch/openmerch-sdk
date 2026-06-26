# quick-start

A zero-dependency script that runs a live company enrichment job against the OpenMerch API. No `npm install` needed — just Node 18+ and an API key.

## Prerequisites

- Node.js 18+
- An OpenMerch API key (`om_live_...`)

## Run

Download the script and run it — no clone, no install:

```bash
curl -O https://raw.githubusercontent.com/openmerch/openmerch-sdk/main/examples/quick-start/quick-start.mjs
OPENMERCH_API_KEY=om_live_... node quick-start.mjs amazon.com | less +G
```

If you already have the repo cloned:

```bash
cd examples/quick-start
OPENMERCH_API_KEY=om_live_... node quick-start.mjs amazon.com | less +G
```

Use `OPENMERCH_BASE_URL` to point at a different environment:

```bash
OPENMERCH_BASE_URL=https://api.openmerch.dev OPENMERCH_API_KEY=om_live_... node quick-start.mjs amazon.com | less +G
```

> **Navigating the Terminal output:** Press `g` to jump to the top, `G` to jump to the bottom, `q` to quit.

## What It Does

1. Validates `company_enrichment_v1` is available in the live catalog
2. Plans the job to get a cost estimate
3. Executes the job (polls until complete if the job runs async)
4. Prints the output, cost in USD, and job ID

## Sample Output

<!-- illustrative — actual output varies by domain and provider -->

```
=== Result ===
{
  "company_name": "Amazon",
  "domain": "amazon.com",
  "industry": "E-Commerce & Cloud Computing",
  "description": "Amazon is a multinational technology company focusing on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
  "employee_count": 1500000,
  "location": {
    "city": "Seattle",
    "state": "WA",
    "country": "US"
  },
  "website": "https://amazon.com",
  "linkedin_url": "https://www.linkedin.com/company/amazon"
}

Cost:   $0.0200 USD
Job ID: job_01HXK9QVBN3M4RPYG2WJKFZ8
```

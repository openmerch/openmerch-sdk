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

<!-- illustrative — actual output varies by domain and provider -->

```
=== Result ===
{
  "company_name": "Stripe",
  "domain": "stripe.com",
  "industry": "Financial Services",
  "description": "Stripe builds economic infrastructure for the internet, enabling businesses of all sizes to accept payments and manage revenue online.",
  "employee_count": 8000,
  "location": {
    "city": "San Francisco",
    "state": "CA",
    "country": "US"
  },
  "website": "https://stripe.com",
  "linkedin_url": "https://www.linkedin.com/company/stripe"
}

Cost:   $0.0200 USD
Job ID: job_01HXK9QVBN3M4RPYG2WJKFZ8
```

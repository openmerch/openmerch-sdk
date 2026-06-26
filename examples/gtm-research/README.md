# gtm-research

A TypeScript SDK example that runs two sequential enrichment jobs — company data first, then contacts — against the live OpenMerch API.

> **Quickest path:** `curl -O` the zero-dep script below and run it in two lines. The TypeScript SDK version (`src/index.ts`) is available for developers integrating the `@openmerch/agent` package.

This is the pattern a research agent uses: submit typed data jobs and get structured results back, without stitching together multiple data providers.

## Prerequisites

- Node.js 18+
- An OpenMerch API key (`om_live_...`)

## Run

Download and run — no clone, no install:

```bash
curl -O https://raw.githubusercontent.com/openmerch/openmerch-sdk/main/examples/gtm-research/gtm-research.mjs
OPENMERCH_API_KEY=om_live_... node gtm-research.mjs amazon.com 'workforce planning' | less +G
```

The second argument is the people-search keyword — defaults to `workforce planning` if omitted.

> **Navigating the Terminal output:** Press `g` to jump to the top, `G` to jump to the bottom, `q` to quit.

### Developer integration (TypeScript SDK)

If you're integrating the `@openmerch/agent` SDK into your own project, `src/index.ts` shows the same flow using the full typed SDK. It requires the repo:

```bash
git clone --depth 1 https://github.com/openmerch/openmerch-sdk.git
cd openmerch-sdk && npm install && npm run build
cd examples/gtm-research
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'workforce planning' | less +G
```

Use `OPENMERCH_BASE_URL` to point at a different environment:

```bash
OPENMERCH_BASE_URL=https://api.openmerch.dev OPENMERCH_API_KEY=om_live_... node gtm-research.mjs amazon.com 'workforce planning' | less +G
```

## What It Does

1. Discovers available job types from the live catalog
2. Runs a company enrichment job for the given domain
3. Runs a people search (`people-search` operation) using `q_organization_domains` + `q_keywords` to find matching contacts
4. Enriches the first contact individually (`people-enrichment` operation) using their person ID and name from step 3's results
5. Prints a summary of all three results with cost and job ID

## Sample Output

<!-- illustrative — actual output varies by domain and provider -->

```
Fetching company data for amazon.com...
Searching for "workforce planning" contacts at amazon.com...

=== Company ===
{
  "company_name": "Amazon",
  "domain": "amazon.com",
  "industry": "E-Commerce & Cloud Computing",
  "description": "Amazon is a multinational technology company focusing on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
  "employee_count": 1500000,
  "location": { "city": "Seattle", "state": "WA", "country": "US" },
  "website": "https://amazon.com"
}
Cost: $0.0200 USD  Job: job_01HXK9QVBN3M4RPYG2WJKFZ8

=== Contacts ===
[
  { "id": "55708d7a736964670fa50e00", "first_name": "Sarah", "last_name": "M.", "title": "Director, Workforce Planning", "email": "s.m@amazon.com" },
  { "id": "55708d7a736964670fa50e01", "first_name": "James", "last_name": "K.", "title": "VP Global Workforce Strategy", "email": "j.k@amazon.com" }
]
Cost: $0.0310 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZ9

Enriching contact 55708d7a736964670fa50e00...

=== Person ===
{
  "id": "55708d7a736964670fa50e00",
  "first_name": "Sarah",
  "last_name": "M.",
  "title": "Director, Workforce Planning",
  "email": "s.m@amazon.com",
  "linkedin_url": "https://linkedin.com/in/sarahm-amazon",
  "location": { "city": "Seattle", "state": "WA", "country": "US" },
  "employment_history": [
    { "company": "Amazon", "title": "Director, Workforce Planning", "start_year": 2019 }
  ]
}
Cost: $0.0150 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZA
```

# gtm-research

A TypeScript SDK example that runs two sequential enrichment jobs — company data first, then contacts — against the live OpenMerch API.

This is the pattern a research agent uses: submit typed data jobs and get structured results back, without stitching together multiple data providers.

## Prerequisites

- Node.js 18+
- An OpenMerch API key (`om_live_...`)

## Run

Clone and run — no prior setup needed:

```bash
git clone --depth 1 https://github.com/openmerch/openmerch-sdk.git
cd openmerch-sdk && npm install && npm run build
cd examples/gtm-research
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'director VP' | less +G
```

If you already have the repo cloned:

```bash
# From repo root
npm install && npm run build
cd examples/gtm-research
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'director VP' | less +G
```

The second argument is the people-search keyword — defaults to `director VP` if omitted. Use it to target specific roles:

```bash
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'workforce planning' | less +G
```

Use `OPENMERCH_BASE_URL` to point at a different environment:

```bash
OPENMERCH_BASE_URL=https://api.openmerch.dev OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'director VP' | less +G
```

> **Navigating the Terminal output:** Press `g` to jump to the top, `G` to jump to the bottom, `q` to quit.

## What It Does

1. Discovers available job types from the live catalog
2. Runs a company enrichment job for the given domain
3. Runs a people search (`people-search` operation) using `q_organization_domains` + `q_keywords` to find matching contacts
4. Prints a summary of both results with cost and job ID

## Sample Output

<!-- illustrative — actual output varies by domain and provider -->

```
Fetching company data for amazon.com...
Searching for "director VP" contacts at amazon.com...

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
  { "name": "Sarah M.", "title": "Director, Enterprise Sales", "email": "s.m@amazon.com" },
  { "name": "James K.", "title": "VP Global Accounts", "email": "j.k@amazon.com" },
  { "name": "Priya R.", "title": "Director, Partner Development", "email": "p.r@amazon.com" }
]
Cost: $0.0310 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZ9
```

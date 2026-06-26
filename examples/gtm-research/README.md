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

# Step 1 + 2: company data + contacts search
OPENMERCH_API_KEY=om_live_... node gtm-research.mjs amazon.com 'workforce planning' | less +G

# Step 3: enrich a specific contact — copy their id from the Contacts output above
OPENMERCH_API_KEY=om_live_... node gtm-research.mjs amazon.com 'workforce planning' <person-id> | less +G
```

The second argument is the people-search keyword — defaults to `workforce planning` if omitted. The third argument is an optional person ID for individual contact enrichment.

> **Navigating the Terminal output:** Press `g` to jump to the top, `G` to jump to the bottom, `q` to quit.

### Developer integration (TypeScript SDK)

If you're integrating the `@openmerch/agent` SDK into your own project, `src/index.ts` shows the same flow using the full typed SDK. It requires the repo:

```bash
git clone --depth 1 https://github.com/openmerch/openmerch-sdk.git
cd openmerch-sdk && npm install && npm run build
cd examples/gtm-research

# Step 1 + 2
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'workforce planning' | less +G

# Step 3
OPENMERCH_API_KEY=om_live_... npm start -- amazon.com 'workforce planning' <person-id> | less +G
```

## What It Does

**Step 1 + 2** (default):
1. Discovers available job types from the live catalog
2. Runs a company enrichment job for the given domain
3. Runs a people search (`people-search` operation) using `q_organization_domains` + `q_keywords` to find matching contacts
4. Prints results with cost and job IDs, then shows the step 3 command to run next

**Step 3** (pass a person ID as the third argument):
- Enriches a specific contact (`people-enrichment` operation) by ID, returning their full profile

## Sample Output

<!-- illustrative — actual output varies by domain and provider -->

**Step 1 + 2:**

```
Fetching company data for amazon.com...
Searching for "workforce planning" contacts at amazon.com...

=== Company ===
{
  "company_name": "Amazon",
  "domain": "amazon.com",
  "industry": "E-Commerce & Cloud Computing",
  "employee_count": 1500000,
  "location": { "city": "Seattle", "state": "WA", "country": "US" }
}
Cost: $0.0200 USD  Job: job_01HXK9QVBN3M4RPYG2WJKFZ8

=== Contacts ===
{
  "people": [
    { "id": "55708d7a736964670fa50e00", "first_name": "Sarah", "last_name_obfuscated": "M***", "title": "Director, Workforce Planning" },
    { "id": "55708d7a736964670fa50e01", "first_name": "James", "last_name_obfuscated": "K***", "title": "VP Global Workforce Strategy" }
  ]
}
Cost: $0.0059 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZ9

To enrich a specific contact, copy their id from the output above and run:
  OPENMERCH_API_KEY=... node gtm-research.mjs amazon.com 'workforce planning' 55708d7a736964670fa50e00 | less +G
```

**Step 3** (passing the person ID):

```
Enriching contact 55708d7a736964670fa50e00...

=== Person ===
{
  "id": "55708d7a736964670fa50e00",
  "first_name": "Sarah",
  "last_name": "Mitchell",
  "title": "Director, Workforce Planning",
  "email": "s.mitchell@amazon.com",
  "linkedin_url": "https://linkedin.com/in/sarah-mitchell-amazon",
  "location": { "city": "Seattle", "state": "WA", "country": "US" }
}
Cost: $0.0150 USD  Job: job_01HXK9QVCN5M4RPYG2WJKFZA
```

# @openmerch/agent

## 0.3.0

### Minor Changes

- 9938109: Replace preview types-only surface with V1 runtime SDK. Breaking: all previous type exports (`TaskRequest`, `ServiceQuery`, `WalletBalance`, etc.) removed. New exports: `OpenMerchAgent` class with HTTP client, V1 job types (`PlanJobRequest`, `ExecuteJobRequest`, `JobResponse`, `CostEstimate`, `JobCost`), MPP payment types, billing types, and error classes.

## 0.2.6

### Patch Changes

- 69d3aa9: Reposition README and package metadata for preview scope. Adds preview banner, "What Works Today" and "What Is Not Yet Shipped" sections, rewords npm descriptions to type-contract language, and adds pre-1.0 stability note. No runtime functionality added.

## 0.2.5

### Patch Changes

- Remove broken changelog link from package READMEs.

## 0.2.4

### Patch Changes

- Add payment support note to package READMEs: USD-denominated pricing, USDC settlement on Base and Base Sepolia.

## 0.2.3

### Patch Changes

- Fix "Machine Payable Protocol" naming in READMEs — remove hyphens from prose references.

## 0.2.2

### Patch Changes

- Add MPP framing to package READMEs so npm package pages reflect the updated documentation.

## 0.2.1

### Patch Changes

- Move package metadata to the public openmerch/openmerch-sdk repo. Aligns homepage, repository, bugs, and issues links. Establishes the initial public SDK monorepo surface.

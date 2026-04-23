---
"@openmerch/agent": minor
---

Replace preview types-only surface with V1 runtime SDK. Breaking: all previous type exports (`TaskRequest`, `ServiceQuery`, `WalletBalance`, etc.) removed. New exports: `OpenMerchAgent` class with HTTP client, V1 job types (`PlanJobRequest`, `ExecuteJobRequest`, `JobResponse`, `CostEstimate`, `JobCost`), MPP payment types, billing types, and error classes.

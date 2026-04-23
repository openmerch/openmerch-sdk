// --- SDK config (not a backend shape) ---

export interface AgentConfig {
  /** Base URL of the OpenMerch platform, e.g. "http://localhost:8080" */
  baseUrl: string;
  /** Agent API key (om_live_...) */
  apiKey: string;
  /** Number of retry attempts for execute/runTask. Default: 0 (no retry). */
  retries?: number;
  /** Base delay in ms for exponential backoff. Default: 500. */
  retryBaseMs?: number;
  /** Max delay in ms for exponential backoff. Default: 10000. */
  retryMaxMs?: number;
  /** Default request timeout in ms. Default: 30000. */
  timeoutMs?: number;
  /** Payment handlers for MPP 402 challenge negotiation. Empty = 402 throws. */
  paymentHandlers?: PaymentHandler[];
  /** Preferred payment methods in priority order. Reorders challenge matching. */
  preferredMethods?: string[];
  /** Max 402 re-negotiation attempts before throwing. Default: 3. */
  maxPaymentRetries?: number;
}

// --- MPP payment types ---

/** Handler for a specific MPP payment method. The SDK invokes pay() on 402. */
export interface PaymentHandler {
  /** Payment method name, e.g. "tempo", "lightning", "stripe" */
  method: string;
  /** Execute payment for the given challenge, return credential string for Authorization header. */
  pay: (challenge: MPPChallenge) => Promise<string>;
}

/** Parsed MPP challenge from a WWW-Authenticate header. */
export interface MPPChallenge {
  /** Payment method, e.g. "tempo" */
  method: string;
  /** Payment intent, e.g. "charge" or "session" */
  intent: string;
  /** Challenge ID */
  id: string;
  /** All parsed key-value pairs from the WWW-Authenticate header */
  params: Record<string, string>;
}

// --- OMQL request: matches POST /v1/query wire format exactly ---

export interface OMQLRequest {
  query_version: string; // "omql/v0.1"
  task: { type: string; category: string };
  constraints?: {
    max_price?: number;
    pricing_unit?: string;
    max_latency_ms?: number;
    execution_mode?: string;
    region?: string;
  };
  filters?: {
    required_tags?: string[];
    excluded_providers?: string[];
    min_reliability_score?: number;
  };
  preferences?: {
    optimize_for?: string; // "cheapest" | "fastest" | "balanced"
    reliability_weight?: number;
    price_weight?: number;
    latency_weight?: number;
  };
  payment?: {
    supported_methods?: string[];
    payment_mode_filter?: "custody" | "mpp";
    preferred_methods?: string[];
  };
}

// --- Candidate: matches routing.Candidate response JSON tags ---

export interface Candidate {
  service_id: string;
  provider_id: string;
  name: string;
  category: string;
  price_estimate: number; // microcents
  pricing_unit: string;
  latency_class: string;
  region: string;
  tags: string[];
  reliability_score: number;
  routing_score: number;
  payment_mode: string;
  payment_methods: { method: string; intent: string }[];
  payment_compatible?: boolean;
  matched_payment_methods?: string[];
}

// --- Query response: matches routing.QueryResponse ---

export interface QueryResponse {
  candidates: Candidate[];
  query_version: string;
  total_candidates: number;
}

// --- Execute request/response: matches execution types ---

export interface ExecuteOptions {
  service_id: string;
  payload: Record<string, unknown>;
  max_cost: number; // microcents
  idempotency_key: string;
  mode?: "sync" | "async" | "streaming";
  timeout_ms?: number;
}

/** Matches ExecuteResponse JSON tags exactly. */
export interface ExecuteResult {
  execution_id: string;
  status: string;
  output?: unknown;
  units_used: number;
  total_cost: number;
  platform_fee: number;
  provider_payout: number;
  service_id: string;
  provider_id: string;
  /** Payment-Receipt header value from MPP paid execution, if present. */
  payment_receipt?: string;
}

// --- Wallet: matches db.Wallet JSON tags ---

export interface Wallet {
  wallet_id: string;
  agent_id: string;
  balance: number; // microcents
  reserved: number; // microcents
  currency: string;
  updated_at: string; // ISO 8601
}

// --- Billing: card setup types (matches backend JSON tags) ---

/** Billing platform configuration (Stripe publishable key). */
export interface BillingConfig {
  publishable_key: string;
}

/** Result of creating a Stripe SetupIntent for card enrollment. */
export interface SetupIntentResult {
  setup_intent_id: string;
  client_secret: string;
  status: string;
}

/** A card on file. */
export interface CardInfo {
  payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

/** Response from listing cards on file. */
export interface CardListResponse {
  cards: CardInfo[];
}

// --- Convenience wrapper for discover + execute ---

export interface RunTaskOptions {
  task: { type: string; category: string };
  constraints?: OMQLRequest["constraints"];
  filters?: OMQLRequest["filters"];
  preferences?: OMQLRequest["preferences"];
  payment?: OMQLRequest["payment"];
  payload: Record<string, unknown>;
  max_cost: number;
  idempotency_key: string;
  mode?: "sync" | "async";
  timeout_ms?: number;
}

// --- SSE events: matches agent-facing SSE shapes from streaming.go ---

export interface ChunkEvent {
  type: "chunk";
  output: unknown;
  units_used: number;
  cumulative_cost: number;
}

export interface DoneEvent {
  type: "done";
  execution_id: string;
  status: string;
  output: unknown;
  units_used: number;
  total_cost: number;
  platform_fee: number;
  provider_payout: number;
}

export interface ErrorEvent {
  type: "error";
  error: string;
  units_used?: number;
}

export type StreamEvent = ChunkEvent | DoneEvent | ErrorEvent;

// --- V1 Job types (matches internal/job/types.go) ---

/** A single job type entry from GET /v1/catalog. */
export interface CatalogEntry {
  job_type: string;
  description: string;
  mode: string;
  cost_estimate: CostEstimate;
  confidence: number;
  latency_estimate_ms: number;
  operations?: string[];
}

/** V1 POST /v1/plan request body. */
export interface PlanJobRequest {
  job_type: string;
  input: unknown;
}

/** V1 POST /v1/plan response body. */
export interface PlanJobResponse {
  job_type: string;
  can_execute: boolean;
  estimated_cost: CostEstimate;
  confidence: number;
  estimated_latency_ms: number;
  candidate_count: number;
  routing_strategy: string;
}

/** Cost range from /v1/plan. */
export interface CostEstimate {
  min_microcents: number;
  max_microcents: number;
  currency: string;
}

/** V1 POST /v1/execute request body (job-based). */
export interface ExecuteJobRequest {
  job_type: string;
  input: unknown;
  max_cost: number;
  idempotency_key: string;
  timeout_ms?: number;
}

/** V1 job response for POST /v1/execute and GET /v1/jobs/{jobID}. */
export interface JobResponse {
  job_id: string;
  job_type: string;
  status: string;
  output?: unknown;
  cost: JobCost;
  error?: JobError;
  created_at: string;
  updated_at: string;
}

/** Cost sub-object in JobResponse. */
export interface JobCost {
  total_microcents: number;
  currency: string;
}

/** Error detail in JobResponse when status is "failed". */
export interface JobError {
  code: string;
  message: string;
}

/** V1 POST /v1/jobs/{jobID}/cancel response. */
export interface CancelJobResponse {
  job_id: string;
  status: string;
}

// --- V1 Job list types (matches GET /v1/jobs wire format) ---

/** Options for GET /v1/jobs. */
export interface ListJobsOptions {
  cursor?: string;
  limit?: number;
  status?: string;
  job_type?: string;
}

/** A single item in the GET /v1/jobs response. */
export interface JobListItem {
  job_id: string;
  job_type: string;
  status: string;
  cost: JobCost | null;
  error?: JobError;
  output?: unknown;
  created_at: string;
}

/** GET /v1/jobs response envelope. */
export interface JobListResponse {
  jobs: JobListItem[];
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * @openmerch/agent
 *
 * Public type definitions and interfaces for OpenMerch agents.
 * Agents discover services on the OpenMerch protocol, execute tasks
 * against providers, and manage wallet balances for payments.
 */

// ---------------------------------------------------------------------------
// Service discovery types
// ---------------------------------------------------------------------------

/** Filter criteria for searching available services. */
export interface ServiceQuery {
  /** Filter by keyword in service name or description. */
  keyword?: string;
  /** Filter by supported execution mode. */
  mode?: "sync" | "async" | "stream";
  /** Maximum price filter (in smallest currency unit). */
  maxPrice?: string;
  /** ISO 4217 currency code or token identifier. */
  currency?: string;
  /** Maximum number of results to return. */
  limit?: number;
  /** Pagination offset. */
  offset?: number;
}

/** A service listing returned from discovery. */
export interface ServiceListing {
  /** Unique service identifier. */
  serviceId: string;
  /** Provider identifier. */
  providerId: string;
  /** Human-readable service name. */
  name: string;
  /** Short description of the service. */
  description: string;
  /** Execution modes available. */
  modes: ("sync" | "async" | "stream")[];
  /** Pricing information. */
  pricing: {
    basePrice: string;
    currency: string;
    unitPrice?: string;
  };
  /** Optional JSON Schema describing the expected input. */
  inputSchema?: Record<string, unknown>;
  /** Optional JSON Schema describing the output. */
  outputSchema?: Record<string, unknown>;
}

/** Paginated result set from a service discovery query. */
export interface ServiceQueryResult {
  services: ServiceListing[];
  total: number;
  offset: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Task execution types
// ---------------------------------------------------------------------------

/** Request to execute a task against a provider's service. */
export interface TaskRequest {
  /** Target service ID. */
  serviceId: string;
  /** Desired execution mode. */
  mode: "sync" | "async" | "stream";
  /** Input payload for the service. */
  payload: unknown;
  /** Optional metadata headers. */
  metadata?: Record<string, string>;
  /** Optional maximum price the agent is willing to pay. */
  maxPrice?: string;
}

/** Result from a synchronous task execution. */
export interface TaskResult {
  /** Unique task/request identifier. */
  taskId: string;
  /** Whether the execution succeeded. */
  success: boolean;
  /** Output payload on success. */
  data?: unknown;
  /** Error information on failure. */
  error?: { code: string; message: string };
  /** Actual cost charged for this execution. */
  cost?: { amount: string; currency: string };
}

/** Handle for tracking an asynchronous task. */
export interface AsyncTaskHandle {
  /** Job identifier for polling status. */
  jobId: string;
  /** Task identifier. */
  taskId: string;
  /** Current status. */
  status: "pending" | "running" | "completed" | "failed";
}

/** A chunk received during a streaming task execution. */
export interface TaskStreamChunk {
  /** Sequence index (zero-based). */
  index: number;
  /** Chunk payload. */
  data: unknown;
  /** True when this is the final chunk. */
  done: boolean;
}

// ---------------------------------------------------------------------------
// Wallet types
// ---------------------------------------------------------------------------

/** Wallet balance information. */
export interface WalletBalance {
  /** Available balance in the smallest currency unit. */
  available: string;
  /** Pending (held/reserved) balance. */
  pending: string;
  /** ISO 4217 currency code or token identifier. */
  currency: string;
}

/** A single wallet transaction record. */
export interface WalletTransaction {
  /** Transaction identifier. */
  transactionId: string;
  /** Transaction type. */
  type: "payment" | "deposit" | "refund" | "withdrawal";
  /** Amount in smallest currency unit. */
  amount: string;
  /** Currency code or token identifier. */
  currency: string;
  /** Related task ID, if applicable. */
  taskId?: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

/** Configuration for connecting an agent to the OpenMerch network. */
export interface AgentConfig {
  /** OpenMerch network endpoint. */
  endpoint: string;
  /** Agent authentication token. */
  apiKey: string;
  /** Optional agent display name. */
  name?: string;
  /** Default wallet currency preference. */
  defaultCurrency?: string;
}

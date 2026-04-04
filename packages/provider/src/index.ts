/**
 * @openmerch/provider
 *
 * Public type definitions and interfaces for OpenMerch service providers.
 * Providers register services on the OpenMerch protocol and handle
 * sync, async, and streaming execution requests from agents.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Supported execution modes for a service. */
export type ExecutionMode = "sync" | "async" | "stream";

/** Pricing model attached to a service listing. */
export interface PricingModel {
  /** Base price per request in the smallest currency unit. */
  basePrice: string;
  /** ISO 4217 currency code or token identifier. */
  currency: string;
  /** Optional per-unit pricing for metered usage. */
  unitPrice?: string;
}

/** Metadata describing a service that a provider offers. */
export interface ServiceDefinition {
  /** Unique service identifier. */
  id: string;
  /** Human-readable service name. */
  name: string;
  /** Short description of what the service does. */
  description: string;
  /** Execution modes this service supports. */
  modes: ExecutionMode[];
  /** Pricing for this service. */
  pricing: PricingModel;
  /** Optional JSON Schema describing the expected input payload. */
  inputSchema?: Record<string, unknown>;
  /** Optional JSON Schema describing the output payload. */
  outputSchema?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Execution types
// ---------------------------------------------------------------------------

/** Incoming execution request from an agent. */
export interface ExecutionRequest {
  /** Unique request identifier. */
  requestId: string;
  /** The service being invoked. */
  serviceId: string;
  /** Requested execution mode. */
  mode: ExecutionMode;
  /** Arbitrary input payload. */
  payload: unknown;
  /** Optional metadata headers. */
  metadata?: Record<string, string>;
}

/** Result returned from a synchronous execution. */
export interface ExecutionResult {
  /** Mirrors the incoming request ID. */
  requestId: string;
  /** Whether the execution succeeded. */
  success: boolean;
  /** Output payload on success. */
  data?: unknown;
  /** Error information on failure. */
  error?: { code: string; message: string };
}

/** A single chunk emitted during a streaming execution. */
export interface StreamChunk {
  /** Sequence index of this chunk (zero-based). */
  index: number;
  /** Chunk payload. */
  data: unknown;
  /** True when this is the final chunk. */
  done: boolean;
}

// ---------------------------------------------------------------------------
// Handler interfaces
// ---------------------------------------------------------------------------

/** Handler for synchronous execution requests. */
export type SyncHandler = (req: ExecutionRequest) => Promise<ExecutionResult>;

/** Handler for asynchronous execution requests. */
export type AsyncHandler = (req: ExecutionRequest) => Promise<{ jobId: string }>;

/** Handler for streaming execution requests. */
export type StreamHandler = (
  req: ExecutionRequest,
  emit: (chunk: StreamChunk) => void,
) => Promise<void>;

/** Map of execution mode to its corresponding handler. */
export interface ExecutionHandlers {
  sync?: SyncHandler;
  async?: AsyncHandler;
  stream?: StreamHandler;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

/** Configuration for connecting to the OpenMerch network. */
export interface ProviderConfig {
  /** OpenMerch network endpoint. */
  endpoint: string;
  /** Provider authentication token. */
  apiKey: string;
  /** Optional provider display name. */
  name?: string;
  /** Services this provider offers. */
  services: ServiceDefinition[];
  /** Execution handlers keyed by service ID. */
  handlers: Record<string, ExecutionHandlers>;
}

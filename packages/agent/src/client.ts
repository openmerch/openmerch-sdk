import * as http from "node:http";
import * as https from "node:https";
import { PassThrough } from "node:stream";
import type {
  AgentConfig,
  OMQLRequest,
  QueryResponse,
  ExecuteOptions,
  ExecuteResult,
  PaymentHandler,
  MPPChallenge,
  Wallet,
  RunTaskOptions,
  BillingConfig,
  SetupIntentResult,
  CardInfo,
  CardListResponse,
  CatalogEntry,
  PlanJobRequest,
  PlanJobResponse,
  ExecuteJobRequest,
  JobResponse,
  CancelJobResponse,
  ListJobsOptions,
  JobListResponse,
} from "./types.js";
import { ExecutionStream } from "./stream.js";
import {
  parseWWWAuthenticate,
  selectPaymentHandler,
  PaymentRequiredError,
  NoMatchingMethodError,
} from "./mpp.js";

/** Raw HTTP response before JSON parsing. */
interface RawResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** OpenMerch Agent SDK — discover services, execute tasks, manage wallet. */
export class OpenMerchAgent {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly retries: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly timeoutMs: number;
  private readonly paymentHandlers: PaymentHandler[];
  private readonly preferredMethods?: string[];
  private readonly maxPaymentRetries: number;

  constructor(config: AgentConfig) {
    this.baseUrl = new URL(config.baseUrl);
    this.apiKey = config.apiKey;
    this.retries = config.retries ?? 0;
    this.retryBaseMs = config.retryBaseMs ?? 500;
    this.retryMaxMs = config.retryMaxMs ?? 10000;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.paymentHandlers = config.paymentHandlers ?? [];
    this.preferredMethods = config.preferredMethods;
    this.maxPaymentRetries = config.maxPaymentRetries ?? 3;
  }

  // --- Discovery ---

  /**
   * Discover services via OMQL. Auto-injects payment capabilities when handlers
   * are configured: `supported_methods` from handler methods, `preferred_methods`
   * from config. Preferences are only injected when handlers are present
   * (capability must be confirmed before preferences influence ranking).
   * @deprecated Use planJob() + executeJob() for V1 job workflow.
   */
  async discover(request: OMQLRequest): Promise<QueryResponse> {
    let enriched = request;
    const hasHandlers = this.paymentHandlers.length > 0;
    const needsMethods =
      !request.payment?.supported_methods && hasHandlers;
    const needsPrefs =
      !request.payment?.preferred_methods &&
      this.preferredMethods &&
      this.preferredMethods.length > 0 &&
      hasHandlers;

    if (needsMethods || needsPrefs) {
      const payment = { ...request.payment };
      if (needsMethods) {
        payment.supported_methods = this.paymentHandlers.map((h) => h.method);
      }
      if (needsPrefs) {
        payment.preferred_methods = this.preferredMethods;
      }
      enriched = { ...request, payment };
    }
    return this.request<QueryResponse>("POST", "/v1/query", enriched, false);
  }

  /**
   * Get a single service by ID. Returns the raw service JSON from the backend.
   * @deprecated V1 job API does not expose services.
   */
  async getService(serviceId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      "GET",
      `/v1/services/${serviceId}`,
      undefined,
      false,
    );
  }

  // --- Execution ---

  /**
   * Execute a service (sync or async mode). Handles MPP 402 payment challenges
   * transparently if paymentHandlers are configured. Supports retry with
   * idempotency key reuse.
   * @deprecated Use executeJob() for V1 job execution.
   */
  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    const body = {
      service_id: options.service_id,
      idempotency_key: options.idempotency_key,
      max_cost: options.max_cost,
      payload: options.payload,
      mode: options.mode ?? "sync",
      timeout_ms: options.timeout_ms,
    };
    return this.withRetry(async () => {
      const { result, paymentReceipt } =
        await this.requestWithMPP<ExecuteResult>("POST", "/v1/execute", body);
      if (paymentReceipt) {
        result.payment_receipt = paymentReceipt;
      }
      return result;
    });
  }

  /**
   * Execute a service in streaming mode. Returns an ExecutionStream that yields
   * ChunkEvent, DoneEvent, or ErrorEvent via async iteration.
   *
   * Handles MPP 402 payment challenges before the stream begins.
   * No retry — single attempt only.
   * @deprecated V1 streaming not yet available.
   */
  async executeStream(options: ExecuteOptions): Promise<ExecutionStream> {
    const body = {
      service_id: options.service_id,
      idempotency_key: options.idempotency_key,
      max_cost: options.max_cost,
      payload: options.payload,
      mode: "streaming",
      timeout_ms: options.timeout_ms,
    };

    const { stream, paymentReceipt } = await this.rawRequestWithMPP(
      "POST",
      "/v1/execute",
      body,
      { Accept: "text/event-stream" },
    );

    return new ExecutionStream(stream, paymentReceipt);
  }

  /**
   * Get the current state of an execution.
   * @deprecated Use getJob() for V1 job status.
   */
  async getExecution(executionId: string): Promise<ExecuteResult> {
    return this.request<ExecuteResult>(
      "GET",
      `/v1/executions/${executionId}`,
      undefined,
      true,
    );
  }

  /**
   * Cancel an executing or reserved execution.
   * @deprecated Use cancelJob() for V1 cancellation.
   */
  async cancelExecution(executionId: string): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/v1/executions/${executionId}/cancel`,
      null,
      true,
    );
  }

  // --- Convenience ---

  /**
   * Discover + execute in one call. Queries via OMQL, takes the top-ranked
   * candidate, and executes against it. Throws if no candidates found.
   * MVP: no failover to candidate[1] on failure.
   * @deprecated Use planJob() + executeJob().
   */
  async runTask(options: RunTaskOptions): Promise<ExecuteResult> {
    const queryResponse = await this.discover({
      query_version: "omql/v0.1",
      task: options.task,
      constraints: options.constraints,
      filters: options.filters,
      preferences: options.preferences,
      payment: options.payment,
    });

    if (queryResponse.candidates.length === 0) {
      throw new Error("No candidates found for the given query");
    }

    const candidate = queryResponse.candidates[0];
    return this.execute({
      service_id: candidate.service_id,
      payload: options.payload,
      max_cost: options.max_cost,
      idempotency_key: options.idempotency_key,
      mode: options.mode,
      timeout_ms: options.timeout_ms,
    });
  }

  // --- Wallet ---

  /** Get the agent's wallet balance and reserved amount. */
  async getWallet(): Promise<Wallet> {
    return this.request<Wallet>("GET", "/v1/wallet", undefined, true);
  }

  /**
   * @deprecated Fund is an MVP stub. In the no-custody MPP model, agents pay
   * providers directly — there is no wallet to fund with OpenMerch.
   */
  async fund(amount: number): Promise<Wallet> {
    console.warn(
      "OpenMerchAgent.fund() is deprecated. In the MPP model, agents pay providers directly.",
    );
    return this.request<Wallet>(
      "POST",
      "/v1/wallet/fund",
      { amount },
      true,
    );
  }

  // --- Billing ---

  /** Get billing configuration (Stripe publishable key for client-side setup). */
  async getBillingConfig(): Promise<BillingConfig> {
    return this.request<BillingConfig>("GET", "/v1/billing/config", undefined, true);
  }

  /** Create a Stripe SetupIntent for card-on-file enrollment. */
  async createCardSetupIntent(): Promise<SetupIntentResult> {
    return this.request<SetupIntentResult>(
      "POST",
      "/v1/billing/cards/setup-intent",
      undefined,
      true,
    );
  }

  /** Confirm a completed card setup. Call after Stripe.js confirmCardSetup succeeds. */
  async confirmCardSetup(setupIntentId: string): Promise<CardInfo> {
    return this.request<CardInfo>(
      "POST",
      "/v1/billing/cards/confirm",
      { setup_intent_id: setupIntentId },
      true,
    );
  }

  /** List the agent's cards on file. */
  async listCards(): Promise<CardListResponse> {
    return this.request<CardListResponse>("GET", "/v1/billing/cards", undefined, true);
  }

  // --- V1 Jobs ---

  /** List all available job types with metadata. Unauthenticated. */
  async getCatalog(): Promise<CatalogEntry[]> {
    return this.request<CatalogEntry[]>("GET", "/v1/catalog", undefined, false);
  }

  /** Get a cost estimate and feasibility check. Unauthenticated. */
  async planJob(request: PlanJobRequest): Promise<PlanJobResponse> {
    return this.request<PlanJobResponse>("POST", "/v1/plan", request, false);
  }

  /** Execute a job (V1 card-billed, server-orchestrated). */
  async executeJob(request: ExecuteJobRequest): Promise<JobResponse> {
    return this.withRetry(async () => {
      return this.request<JobResponse>("POST", "/v1/execute", request, true);
    });
  }

  /** Get the current state of a job. */
  async getJob(jobId: string): Promise<JobResponse> {
    return this.request<JobResponse>("GET", `/v1/jobs/${jobId}`, undefined, true);
  }

  /** Cancel a job. */
  async cancelJob(jobId: string): Promise<CancelJobResponse> {
    return this.request<CancelJobResponse>("POST", `/v1/jobs/${jobId}/cancel`, null, true);
  }

  /** List jobs for the authenticated agent with optional filters and pagination. */
  async listJobs(options?: ListJobsOptions): Promise<JobListResponse> {
    const params = new URLSearchParams();
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.status) params.set("status", options.status);
    if (options?.job_type) params.set("job_type", options.job_type);
    const qs = params.toString();
    const path = qs ? `/v1/jobs?${qs}` : "/v1/jobs";
    return this.request<JobListResponse>("GET", path, undefined, true);
  }

  /**
   * Poll a job until terminal state (completed, failed, cancelled).
   */
  async pollJob(jobId: string, intervalMs = 1000, timeoutMs = 300000): Promise<JobResponse> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.getJob(jobId);
      if (result.status === "completed" || result.status === "failed" || result.status === "cancelled") {
        return result;
      }
      await sleep(intervalMs);
    }
    throw new Error(`Polling timed out after ${timeoutMs}ms for job ${jobId}`);
  }

  // --- Polling ---

  /**
   * Poll an execution until it reaches a terminal state.
   * Useful for async executions. Polls GET /v1/executions/{id} on an interval.
   * @deprecated Use pollJob() for V1 job polling.
   */
  async pollExecution(
    executionId: string,
    intervalMs = 1000,
    timeoutMs = 300000,
  ): Promise<ExecuteResult> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await this.getExecution(executionId);
      if (
        result.status !== "executing" &&
        result.status !== "reserved"
      ) {
        return result;
      }
      await sleep(intervalMs);
    }

    throw new Error(
      `Polling timed out after ${timeoutMs}ms for execution ${executionId}`,
    );
  }

  // --- Internal HTTP ---

  /**
   * Make an HTTP request and return the raw response (status, headers, body).
   * This is the lowest-level request method — all others build on it.
   */
  private requestRaw(
    method: string,
    path: string,
    body: unknown | undefined,
    authenticated: boolean,
    extraHeaders?: Record<string, string>,
  ): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        ...extraHeaders,
      };
      if (authenticated) {
        headers["X-OpenMerch-Key"] = this.apiKey;
      }

      let data: string | undefined;
      if (body !== undefined && body !== null) {
        data = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(data);
      }

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          timeout: this.timeoutMs,
        },
        (res) => {
          let responseData = "";
          res.on("data", (chunk: Buffer) => {
            responseData += chunk.toString();
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 0,
              headers: res.headers,
              body: responseData,
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeoutMs}ms`));
      });
      req.on("error", reject);

      if (data !== undefined) {
        req.write(data);
      }
      req.end();
    });
  }

  /**
   * Make an HTTP request, check status, parse JSON. Used for non-MPP endpoints.
   */
  private async request<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    authenticated: boolean,
  ): Promise<T> {
    const raw = await this.requestRaw(method, path, body, authenticated);

    if (raw.statusCode >= 200 && raw.statusCode < 300) {
      try {
        return JSON.parse(raw.body) as T;
      } catch {
        throw new Error(`Invalid JSON response: ${raw.body}`);
      }
    }

    throw new OpenMerchError(
      `HTTP ${raw.statusCode}: ${raw.body}`,
      raw.statusCode,
      raw.body,
    );
  }

  /**
   * Make an authenticated request with MPP 402 negotiation.
   * On 402: parse challenges, select handler, pay, retry with credential.
   * On 2xx: parse JSON and extract Payment-Receipt header.
   */
  private async requestWithMPP<T>(
    method: string,
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ result: T; paymentReceipt?: string }> {
    // First request — no payment credential
    let raw = await this.requestRaw(method, path, body, true, extraHeaders);

    for (let attempt = 0; attempt <= this.maxPaymentRetries; attempt++) {
      if (raw.statusCode >= 200 && raw.statusCode < 300) {
        const result = JSON.parse(raw.body) as T;
        const paymentReceipt =
          raw.headers["payment-receipt"] as string | undefined;
        return { result, paymentReceipt };
      }

      if (raw.statusCode !== 402) {
        throw new OpenMerchError(
          `HTTP ${raw.statusCode}: ${raw.body}`,
          raw.statusCode,
          raw.body,
        );
      }

      // 402 — MPP payment required
      const wwwAuth = raw.headers["www-authenticate"];
      const challenges = parseWWWAuthenticate(
        Array.isArray(wwwAuth) ? wwwAuth : wwwAuth ? [wwwAuth] : [],
      );

      if (this.paymentHandlers.length === 0) {
        throw new PaymentRequiredError(challenges, raw.body);
      }

      const match = selectPaymentHandler(
        challenges,
        this.paymentHandlers,
        this.preferredMethods,
      );
      if (!match) {
        throw new NoMatchingMethodError(challenges, raw.body);
      }

      // Execute payment and get credential
      const credential = await match.handler.pay(match.challenge);

      // Retry with payment credential (same body, same idempotency_key)
      raw = await this.requestRaw(method, path, body, true, {
        ...extraHeaders,
        Authorization: `Payment ${credential}`,
      });
    }

    // Exhausted payment retries — still getting 402
    throw new PaymentRequiredError(
      parseWWWAuthenticate(
        Array.isArray(raw.headers["www-authenticate"])
          ? raw.headers["www-authenticate"]
          : raw.headers["www-authenticate"]
            ? [raw.headers["www-authenticate"]]
            : [],
      ),
      raw.body,
    );
  }

  /**
   * Make a raw streaming request with MPP 402 negotiation.
   * Returns the IncomingMessage stream after payment negotiation completes.
   */
  private async rawRequestWithMPP(
    method: string,
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ stream: http.IncomingMessage; paymentReceipt?: string }> {
    // First request — need to inspect status before deciding to stream or negotiate
    const firstRaw = await this.requestRaw(
      method,
      path,
      body,
      true,
      extraHeaders,
    );

    if (firstRaw.statusCode >= 200 && firstRaw.statusCode < 300) {
      // Non-MPP success on first attempt — wrap body into a readable stream
      const passthrough = new PassThrough();
      passthrough.end(firstRaw.body);
      const paymentReceipt =
        firstRaw.headers["payment-receipt"] as string | undefined;
      return {
        stream: passthrough as unknown as http.IncomingMessage,
        paymentReceipt,
      };
    }

    if (firstRaw.statusCode !== 402) {
      throw new OpenMerchError(
        `HTTP ${firstRaw.statusCode}: ${firstRaw.body}`,
        firstRaw.statusCode,
        firstRaw.body,
      );
    }

    // 402 negotiation loop
    let lastRaw = firstRaw;
    for (let attempt = 0; attempt < this.maxPaymentRetries; attempt++) {
      const wwwAuth = lastRaw.headers["www-authenticate"];
      const challenges = parseWWWAuthenticate(
        Array.isArray(wwwAuth) ? wwwAuth : wwwAuth ? [wwwAuth] : [],
      );

      if (this.paymentHandlers.length === 0) {
        throw new PaymentRequiredError(challenges, lastRaw.body);
      }

      const match = selectPaymentHandler(
        challenges,
        this.paymentHandlers,
        this.preferredMethods,
      );
      if (!match) {
        throw new NoMatchingMethodError(challenges, lastRaw.body);
      }

      const credential = await match.handler.pay(match.challenge);

      // Paid retry — for streaming, we need the raw IncomingMessage (not buffered)
      const paidResult = await this.rawStreamRequest(
        method,
        path,
        body,
        {
          ...extraHeaders,
          Authorization: `Payment ${credential}`,
        },
      );

      if (paidResult.statusCode >= 200 && paidResult.statusCode < 300) {
        const paymentReceipt =
          paidResult.headers["payment-receipt"] as string | undefined;
        return { stream: paidResult.stream, paymentReceipt };
      }

      if (paidResult.statusCode !== 402) {
        // Buffer the error response for the error message
        const errBody = await bufferStream(paidResult.stream);
        throw new OpenMerchError(
          `HTTP ${paidResult.statusCode}: ${errBody}`,
          paidResult.statusCode,
          errBody,
        );
      }

      // Renewed 402 — buffer and loop
      const renewedBody = await bufferStream(paidResult.stream);
      lastRaw = {
        statusCode: paidResult.statusCode,
        headers: paidResult.headers,
        body: renewedBody,
      };
    }

    // Exhausted retries
    throw new PaymentRequiredError(
      parseWWWAuthenticate(
        Array.isArray(lastRaw.headers["www-authenticate"])
          ? lastRaw.headers["www-authenticate"]
          : lastRaw.headers["www-authenticate"]
            ? [lastRaw.headers["www-authenticate"]]
            : [],
      ),
      lastRaw.body,
    );
  }

  /**
   * Make a raw streaming HTTP request that returns the IncomingMessage directly.
   * Unlike requestRaw(), this does NOT buffer the body — the caller gets the live stream.
   */
  private rawStreamRequest(
    method: string,
    path: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    stream: http.IncomingMessage;
  }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        ...extraHeaders,
      };
      headers["X-OpenMerch-Key"] = this.apiKey;

      let data: string | undefined;
      if (body !== undefined && body !== null) {
        data = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
        headers["Content-Length"] = Buffer.byteLength(data);
      }

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          timeout: this.timeoutMs,
        },
        (res) => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            stream: res,
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timed out after ${this.timeoutMs}ms`));
      });
      req.on("error", reject);

      if (data !== undefined) {
        req.write(data);
      }
      req.end();
    });
  }

  // --- Retry ---

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = this.retries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isLast = attempt === maxAttempts - 1;
        if (isLast || !isRetryable(err)) {
          throw err;
        }

        const delay = Math.min(
          this.retryBaseMs * Math.pow(2, attempt),
          this.retryMaxMs,
        );
        const jitter = delay * Math.random() * 0.25;
        await sleep(delay + jitter);
      }
    }

    // Unreachable, but TypeScript needs it
    throw new Error("Retry loop exited unexpectedly");
  }
}

/** Error class that includes HTTP status code. */
export class OpenMerchError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "OpenMerchError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof OpenMerchError) {
    // Only retry on gateway errors (not 402 — that's MPP negotiation)
    return err.statusCode === 502 || err.statusCode === 504;
  }
  // Retry on network errors (ECONNREFUSED, ECONNRESET, etc.)
  if (err instanceof Error && "code" in err) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bufferStream(stream: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

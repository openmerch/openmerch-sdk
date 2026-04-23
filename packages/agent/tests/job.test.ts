import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { OpenMerchAgent, OpenMerchError } from "../src/client.js";
import type {
  PlanJobResponse,
  JobResponse,
  CancelJobResponse,
  JobListResponse,
} from "../src/types.js";

// --- Test helpers (same pattern as billing.test.ts) ---

function createMockServer(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
  });
}

// --- Mock data ---

const mockPlanResponse: PlanJobResponse = {
  job_type: "lead_qualification_v1",
  can_execute: true,
  estimated_cost: { min_microcents: 500000, max_microcents: 2000000, currency: "usd" },
  confidence: 0.95,
  estimated_latency_ms: 3000,
  candidate_count: 2,
  routing_strategy: "balanced_v1",
};

const mockJobResponse: JobResponse = {
  job_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  job_type: "lead_qualification_v1",
  status: "completed",
  output: { result: "qualified" },
  cost: { total_microcents: 1000000, currency: "usd" },
  created_at: "2026-04-07T10:00:00Z",
  updated_at: "2026-04-07T10:00:01Z",
};

const mockCancelResponse: CancelJobResponse = {
  job_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  status: "cancelled",
};

// --- Tests ---

describe("V1 Job methods", () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  it("planJob sends POST /v1/plan without auth header", async () => {
    let capturedReq: { method?: string; url?: string; hasAuth?: boolean; body?: string } = {};

    const mock = await createMockServer(async (req, res) => {
      capturedReq.method = req.method;
      capturedReq.url = req.url;
      capturedReq.hasAuth = !!req.headers["x-openmerch-key"];
      capturedReq.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockPlanResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.planJob({
      job_type: "lead_qualification_v1",
      input: { company: "Acme" },
    });

    assert.equal(capturedReq.method, "POST");
    assert.equal(capturedReq.url, "/v1/plan");
    assert.equal(capturedReq.hasAuth, false);
    const body = JSON.parse(capturedReq.body!);
    assert.equal(body.job_type, "lead_qualification_v1");
    assert.deepEqual(body.input, { company: "Acme" });

    assert.equal(result.can_execute, true);
    assert.equal(result.confidence, 0.95);
    assert.equal(result.estimated_cost.min_microcents, 500000);
    assert.equal(result.candidate_count, 2);
    assert.equal(result.routing_strategy, "balanced_v1");
  });

  it("executeJob sends POST /v1/execute with auth", async () => {
    let capturedReq: { method?: string; url?: string; authKey?: string; body?: string } = {};

    const mock = await createMockServer(async (req, res) => {
      capturedReq.method = req.method;
      capturedReq.url = req.url;
      capturedReq.authKey = req.headers["x-openmerch-key"] as string;
      capturedReq.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockJobResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test_key",
    });

    const result = await agent.executeJob({
      job_type: "lead_qualification_v1",
      input: { company: "Acme" },
      max_cost: 2000000,
      idempotency_key: "test-idem-1",
      timeout_ms: 30000,
    });

    assert.equal(capturedReq.method, "POST");
    assert.equal(capturedReq.url, "/v1/execute");
    assert.equal(capturedReq.authKey, "om_live_test_key");
    const body = JSON.parse(capturedReq.body!);
    assert.equal(body.job_type, "lead_qualification_v1");
    assert.equal(body.max_cost, 2000000);
    assert.equal(body.idempotency_key, "test-idem-1");
    assert.equal(body.timeout_ms, 30000);

    assert.equal(result.status, "completed");
    assert.equal(result.job_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.equal(result.cost.total_microcents, 1000000);
  });

  it("executeJob returns 202 for async job", async () => {
    const asyncResponse: JobResponse = { ...mockJobResponse, status: "executing", output: undefined };

    const mock = await createMockServer(async (req, res) => {
      await readBody(req);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify(asyncResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.executeJob({
      job_type: "lead_qualification_v1",
      input: {},
      max_cost: 1000000,
      idempotency_key: "test-async",
    });

    assert.equal(result.status, "executing");
  });

  it("getJob sends GET /v1/jobs/{jobId} with auth", async () => {
    let capturedReq: { method?: string; url?: string; authKey?: string } = {};

    const mock = await createMockServer(async (req, res) => {
      capturedReq.method = req.method;
      capturedReq.url = req.url;
      capturedReq.authKey = req.headers["x-openmerch-key"] as string;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockJobResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.getJob("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    assert.equal(capturedReq.method, "GET");
    assert.equal(capturedReq.url, "/v1/jobs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.equal(capturedReq.authKey, "om_live_test");
    assert.equal(result.status, "completed");
  });

  it("cancelJob sends POST /v1/jobs/{jobId}/cancel with auth", async () => {
    let capturedReq: { method?: string; url?: string; authKey?: string } = {};

    const mock = await createMockServer(async (req, res) => {
      capturedReq.method = req.method;
      capturedReq.url = req.url;
      capturedReq.authKey = req.headers["x-openmerch-key"] as string;
      await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockCancelResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.cancelJob("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    assert.equal(capturedReq.method, "POST");
    assert.equal(capturedReq.url, "/v1/jobs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/cancel");
    assert.equal(capturedReq.authKey, "om_live_test");
    assert.equal(result.status, "cancelled");
  });

  it("pollJob polls until terminal status", async () => {
    let requestCount = 0;

    const mock = await createMockServer(async (req, res) => {
      requestCount++;
      const response: JobResponse = requestCount < 3
        ? { ...mockJobResponse, status: "executing", output: undefined }
        : mockJobResponse;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.pollJob("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", 50, 5000);

    assert.equal(result.status, "completed");
    assert.ok(requestCount >= 3, `expected at least 3 requests, got ${requestCount}`);
  });

  it("pollJob throws on timeout", async () => {
    const mock = await createMockServer(async (req, res) => {
      const response: JobResponse = { ...mockJobResponse, status: "executing", output: undefined };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    await assert.rejects(
      () => agent.pollJob("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", 50, 150),
      (err: Error) => {
        assert.match(err.message, /Polling timed out/);
        return true;
      },
    );
  });

  it("listJobs sends GET /v1/jobs with auth", async () => {
    let capturedReq: { method?: string; url?: string; authKey?: string } = {};

    const mockListResponse: JobListResponse = {
      jobs: [
        {
          job_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          job_type: "lead_qualification_v1",
          status: "completed",
          cost: { total_microcents: 1000000, currency: "usd" },
          created_at: "2026-04-07T10:00:00Z",
        },
      ],
      next_cursor: null,
      has_more: false,
    };

    const mock = await createMockServer(async (req, res) => {
      capturedReq.method = req.method;
      capturedReq.url = req.url;
      capturedReq.authKey = req.headers["x-openmerch-key"] as string;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockListResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.listJobs();

    assert.equal(capturedReq.method, "GET");
    assert.equal(capturedReq.url, "/v1/jobs");
    assert.equal(capturedReq.authKey, "om_live_test");
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].job_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    assert.equal(result.jobs[0].job_type, "lead_qualification_v1");
    assert.equal(result.next_cursor, null);
    assert.equal(result.has_more, false);
  });

  it("listJobs builds query string from options", async () => {
    let capturedUrl: string | undefined;

    const mock = await createMockServer(async (req, res) => {
      capturedUrl = req.url;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jobs: [], next_cursor: null, has_more: false }));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    await agent.listJobs({
      limit: 5,
      status: "completed",
      job_type: "lead_qualification_v1",
      cursor: "abc123",
    });

    assert.ok(capturedUrl);
    const url = new URL(capturedUrl, "http://localhost");
    assert.equal(url.pathname, "/v1/jobs");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.equal(url.searchParams.get("status"), "completed");
    assert.equal(url.searchParams.get("job_type"), "lead_qualification_v1");
    assert.equal(url.searchParams.get("cursor"), "abc123");
  });

  it("listJobs parses response with next_cursor and has_more", async () => {
    const mockListResponse: JobListResponse = {
      jobs: [
        {
          job_id: "11111111-1111-1111-1111-111111111111",
          job_type: "lead_qualification_v1",
          status: "completed",
          cost: { total_microcents: 500000, currency: "usd" },
          created_at: "2026-04-07T10:00:00Z",
        },
      ],
      next_cursor: "opaque-cursor-value",
      has_more: true,
    };

    const mock = await createMockServer(async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockListResponse));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.listJobs({ limit: 1 });

    assert.equal(result.has_more, true);
    assert.equal(result.next_cursor, "opaque-cursor-value");
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].cost?.total_microcents, 500000);
  });

  it("executeJob throws OpenMerchError on 400", async () => {
    const mock = await createMockServer(async (req, res) => {
      await readBody(req);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "validation", message: "bad input" }));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    await assert.rejects(
      () => agent.executeJob({
        job_type: "bad",
        input: {},
        max_cost: 100,
        idempotency_key: "err-test",
      }),
      (err: OpenMerchError) => {
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });
});

import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { OpenMerchAgent, OpenMerchError } from "../src/client.js";
import type {
  QueryResponse,
  ExecuteResult,
  Wallet,
  Candidate,
} from "../src/types.js";

// --- Test helpers ---

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

const mockCandidate: Candidate = {
  service_id: "svc-123",
  provider_id: "prov-456",
  name: "Test Service",
  category: "test",
  price_estimate: 50000,
  pricing_unit: "request",
  latency_class: "fast",
  region: "us-east",
  tags: ["test"],
  reliability_score: 0.95,
  routing_score: 88.5,
  payment_mode: "custody",
  payment_methods: [],
};

const mockQueryResponse: QueryResponse = {
  candidates: [mockCandidate],
  query_version: "omql/v0.1",
  total_candidates: 1,
};

const mockExecuteResult: ExecuteResult = {
  execution_id: "exec-789",
  status: "completed",
  output: { result: "hello" },
  units_used: 3,
  total_cost: 30000,
  platform_fee: 900,
  provider_payout: 29100,
  service_id: "svc-123",
  provider_id: "prov-456",
};

const mockWallet: Wallet = {
  wallet_id: "wallet-111",
  agent_id: "agent-222",
  balance: 1000000,
  reserved: 50000,
  currency: "USD",
  updated_at: "2026-03-25T00:00:00Z",
};

// --- Tests ---

describe("OpenMerchAgent", () => {
  let server: http.Server;
  let agent: OpenMerchAgent;

  afterEach(async () => {
    if (server) await closeServer(server);
  });

  describe("discover", () => {
    it("sends OMQL request and returns QueryResponse", async () => {
      let receivedBody = "";
      let receivedPath = "";
      const mock = await createMockServer(async (req, res) => {
        receivedPath = req.url ?? "";
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const result = await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "service", category: "test" },
        preferences: { optimize_for: "cheapest" },
      });

      assert.equal(receivedPath, "/v1/query");
      const body = JSON.parse(receivedBody);
      assert.equal(body.query_version, "omql/v0.1");
      assert.equal(body.task.category, "test");
      assert.equal(body.preferences.optimize_for, "cheapest");

      assert.equal(result.total_candidates, 1);
      assert.equal(result.candidates[0].service_id, "svc-123");
      assert.equal(result.candidates[0].price_estimate, 50000);
      assert.equal(result.candidates[0].routing_score, 88.5);
    });
  });

  describe("execute (sync)", () => {
    it("sends execute request and returns ExecuteResult", async () => {
      let receivedHeaders: http.IncomingHttpHeaders = {};
      const mock = await createMockServer(async (req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockExecuteResult));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const result = await agent.execute({
        service_id: "svc-123",
        payload: { prompt: "hello" },
        max_cost: 500000,
        idempotency_key: "idem-1",
      });

      assert.equal(receivedHeaders["x-openmerch-key"], "om_live_test");
      assert.equal(result.execution_id, "exec-789");
      assert.equal(result.status, "completed");
      assert.equal(result.total_cost, 30000);
      assert.equal(result.platform_fee, 900);
      assert.equal(result.service_id, "svc-123");
    });
  });

  describe("execute (async)", () => {
    it("returns executing status for async mode", async () => {
      const asyncResult: ExecuteResult = {
        ...mockExecuteResult,
        status: "executing",
        output: undefined,
        units_used: 0,
        total_cost: 0,
        platform_fee: 0,
        provider_payout: 0,
      };
      const mock = await createMockServer(async (_req, res) => {
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify(asyncResult));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const result = await agent.execute({
        service_id: "svc-123",
        payload: { text: "async" },
        max_cost: 500000,
        idempotency_key: "idem-async-1",
        mode: "async",
      });

      assert.equal(result.status, "executing");
    });
  });

  describe("executeStream", () => {
    it("iterates SSE events from streaming response", async () => {
      const mock = await createMockServer(async (_req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(
          'event: chunk\ndata: {"output":{"partial":"a"},"units_used":1,"cumulative_cost":10000}\n\n',
        );
        res.write(
          'event: chunk\ndata: {"output":{"partial":"b"},"units_used":2,"cumulative_cost":20000}\n\n',
        );
        res.write(
          'event: done\ndata: {"execution_id":"exec-1","status":"completed","output":{"final":"ab"},"units_used":2,"total_cost":20000,"platform_fee":600,"provider_payout":19400}\n\n',
        );
        res.end();
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const stream = await agent.executeStream({
        service_id: "svc-123",
        payload: { prompt: "stream" },
        max_cost: 500000,
        idempotency_key: "idem-stream-1",
      });

      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      assert.equal(events.length, 3);
      assert.equal(events[0].type, "chunk");
      if (events[0].type === "chunk") {
        assert.equal(events[0].cumulative_cost, 10000);
      }
      assert.equal(events[2].type, "done");
      if (events[2].type === "done") {
        assert.equal(events[2].total_cost, 20000);
        assert.equal(events[2].execution_id, "exec-1");
      }
    });
  });

  describe("pollExecution", () => {
    it("polls until terminal state", async () => {
      let callCount = 0;
      const mock = await createMockServer(async (_req, res) => {
        callCount++;
        const result: ExecuteResult = {
          ...mockExecuteResult,
          status: callCount < 3 ? "executing" : "completed",
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const result = await agent.pollExecution("exec-789", 50, 5000);
      assert.equal(result.status, "completed");
      assert.equal(callCount, 3);
    });
  });

  describe("cancelExecution", () => {
    it("sends cancel request", async () => {
      let receivedPath = "";
      let receivedMethod = "";
      const mock = await createMockServer(async (req, res) => {
        receivedPath = req.url ?? "";
        receivedMethod = req.method ?? "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "cancelled" }));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      await agent.cancelExecution("exec-789");
      assert.equal(receivedPath, "/v1/executions/exec-789/cancel");
      assert.equal(receivedMethod, "POST");
    });
  });

  describe("runTask", () => {
    it("chains discover + execute using candidates[0].service_id", async () => {
      let requestCount = 0;
      const mock = await createMockServer(async (req, res) => {
        requestCount++;
        if (req.url === "/v1/query") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(mockQueryResponse));
        } else if (req.url === "/v1/execute") {
          const body = JSON.parse(await readBody(req));
          assert.equal(body.service_id, "svc-123");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(mockExecuteResult));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const result = await agent.runTask({
        task: { type: "service", category: "test" },
        payload: { prompt: "one-shot" },
        max_cost: 500000,
        idempotency_key: "task-1",
      });

      assert.equal(requestCount, 2);
      assert.equal(result.execution_id, "exec-789");
    });
  });

  describe("getWallet / fund", () => {
    it("returns wallet with correct shape", async () => {
      const mock = await createMockServer(async (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockWallet));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const wallet = await agent.getWallet();
      assert.equal(wallet.wallet_id, "wallet-111");
      assert.equal(wallet.balance, 1000000);
      assert.equal(wallet.reserved, 50000);
      assert.equal(wallet.currency, "USD");
    });

    it("fund returns updated wallet (stubbed, immediate)", async () => {
      let receivedBody = "";
      const fundedWallet = { ...mockWallet, balance: 2000000 };
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fundedWallet));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const wallet = await agent.fund(1000000);
      const body = JSON.parse(receivedBody);
      assert.equal(body.amount, 1000000);
      assert.equal(wallet.balance, 2000000);
    });
  });

  describe("retry on 502", () => {
    it("retries with same idempotency_key on 502", async () => {
      let callCount = 0;
      const receivedKeys: string[] = [];
      const mock = await createMockServer(async (req, res) => {
        callCount++;
        const body = JSON.parse(await readBody(req));
        receivedKeys.push(body.idempotency_key);

        if (callCount === 1) {
          res.writeHead(502);
          res.end("Bad Gateway");
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(mockExecuteResult));
        }
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        retries: 2,
        retryBaseMs: 10, // fast for tests
      });

      const result = await agent.execute({
        service_id: "svc-123",
        payload: {},
        max_cost: 500000,
        idempotency_key: "retry-key",
      });

      assert.equal(callCount, 2);
      assert.equal(receivedKeys[0], "retry-key");
      assert.equal(receivedKeys[1], "retry-key");
      assert.equal(result.execution_id, "exec-789");
    });
  });

  describe("no retry on 400", () => {
    it("immediately fails on 400 without retrying", async () => {
      let callCount = 0;
      const mock = await createMockServer(async (_req, res) => {
        callCount++;
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad request" }));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        retries: 3,
        retryBaseMs: 10,
      });

      await assert.rejects(
        () =>
          agent.execute({
            service_id: "svc-123",
            payload: {},
            max_cost: 500000,
            idempotency_key: "no-retry",
          }),
        (err: unknown) => {
          assert.ok(err instanceof OpenMerchError);
          assert.equal(err.statusCode, 400);
          return true;
        },
      );

      assert.equal(callCount, 1);
    });
  });

  describe("SSE stream collect()", () => {
    it("returns DoneEvent after consuming all events", async () => {
      const mock = await createMockServer(async (_req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.write(
          'event: chunk\ndata: {"output":"a","units_used":1,"cumulative_cost":10000}\n\n',
        );
        res.write(
          'event: done\ndata: {"execution_id":"exec-1","status":"completed","output":"ab","units_used":2,"total_cost":20000,"platform_fee":600,"provider_payout":19400}\n\n',
        );
        res.end();
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const stream = await agent.executeStream({
        service_id: "svc-123",
        payload: {},
        max_cost: 500000,
        idempotency_key: "collect-1",
      });

      const done = await stream.collect();
      assert.equal(done.type, "done");
      assert.equal(done.total_cost, 20000);
      assert.equal(done.execution_id, "exec-1");
    });
  });

  describe("SSE stream error", () => {
    it("collect() throws on error event", async () => {
      const mock = await createMockServer(async (_req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        res.write(
          'event: chunk\ndata: {"output":"a","units_used":1,"cumulative_cost":10000}\n\n',
        );
        res.write(
          'event: error\ndata: {"error":"provider crashed","units_used":1}\n\n',
        );
        res.end();
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      const stream = await agent.executeStream({
        service_id: "svc-123",
        payload: {},
        max_cost: 500000,
        idempotency_key: "error-1",
      });

      await assert.rejects(() => stream.collect(), {
        message: "Stream error: provider crashed",
      });
    });
  });

  describe("discover payment auto-injection", () => {
    it("auto-injects supported_methods from configured handlers", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        paymentHandlers: [
          { method: "tempo", pay: async () => "cred" },
          { method: "stripe", pay: async () => "cred" },
        ],
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
      });

      const body = JSON.parse(receivedBody);
      assert.deepEqual(body.payment.supported_methods, ["tempo", "stripe"]);
    });

    it("does not inject when no handlers configured", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
      });

      const body = JSON.parse(receivedBody);
      assert.equal(body.payment, undefined);
    });

    it("does not overwrite explicit supported_methods", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        paymentHandlers: [
          { method: "tempo", pay: async () => "cred" },
        ],
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
        payment: { supported_methods: ["lightning"] },
      });

      const body = JSON.parse(receivedBody);
      assert.deepEqual(body.payment.supported_methods, ["lightning"]);
    });

    it("auto-injects preferred_methods when handlers and preferredMethods configured", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        paymentHandlers: [
          { method: "tempo", pay: async () => "cred" },
          { method: "lightning", pay: async () => "cred" },
        ],
        preferredMethods: ["tempo"],
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
      });

      const body = JSON.parse(receivedBody);
      assert.deepEqual(body.payment.supported_methods, ["tempo", "lightning"]);
      assert.deepEqual(body.payment.preferred_methods, ["tempo"]);
    });

    it("does not inject preferred_methods when no handlers configured", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        preferredMethods: ["tempo"],
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
      });

      const body = JSON.parse(receivedBody);
      assert.equal(body.payment, undefined);
    });

    it("does not overwrite explicit preferred_methods", async () => {
      let receivedBody = "";
      const mock = await createMockServer(async (req, res) => {
        receivedBody = await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockQueryResponse));
      });
      server = mock.server;

      agent = new OpenMerchAgent({
        baseUrl: `http://127.0.0.1:${mock.port}`,
        apiKey: "om_live_test",
        paymentHandlers: [
          { method: "tempo", pay: async () => "cred" },
        ],
        preferredMethods: ["tempo"],
      });

      await agent.discover({
        query_version: "omql/v0.1",
        task: { type: "test", category: "test" },
        payment: { preferred_methods: ["lightning"] },
      });

      const body = JSON.parse(receivedBody);
      assert.deepEqual(body.payment.preferred_methods, ["lightning"]);
    });
  });
});

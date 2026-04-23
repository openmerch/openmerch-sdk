import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { OpenMerchAgent } from "../src/client.js";
import { parseWWWAuthenticate, PaymentRequiredError, NoMatchingMethodError } from "../src/mpp.js";
import type { PaymentHandler } from "../src/types.js";

// --- Test helpers ---

function createMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
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

const tempoHandler: PaymentHandler = {
  method: "tempo",
  pay: async (challenge) => {
    return `tempo-credential-for-${challenge.id}`;
  },
};

const stripeHandler: PaymentHandler = {
  method: "stripe",
  pay: async (challenge) => {
    return `stripe-credential-for-${challenge.id}`;
  },
};

const successResult = {
  execution_id: "exec-1",
  status: "completed",
  output: { result: "ok" },
  units_used: 5,
  total_cost: 50000,
  platform_fee: 1500,
  provider_payout: 0,
  service_id: "svc-1",
  provider_id: "prov-1",
};

describe("MPP WWW-Authenticate parsing", () => {
  it("parses a single challenge", () => {
    const challenges = parseWWWAuthenticate([
      'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
    ]);
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].method, "tempo");
    assert.equal(challenges[0].intent, "charge");
    assert.equal(challenges[0].id, "ch_1");
    assert.equal(challenges[0].params.request, "50000");
  });

  it("parses multiple challenges", () => {
    const challenges = parseWWWAuthenticate([
      'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
      'Payment method="stripe", intent="charge", id="ch_2", request="50000"',
    ]);
    assert.equal(challenges.length, 2);
    assert.equal(challenges[0].method, "tempo");
    assert.equal(challenges[1].method, "stripe");
  });

  it("skips non-Payment scheme headers", () => {
    const challenges = parseWWWAuthenticate([
      'Basic realm="test"',
      'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
    ]);
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].method, "tempo");
  });

  it("skips malformed challenges missing required fields", () => {
    const challenges = parseWWWAuthenticate([
      'Payment method="tempo"', // missing intent and id
    ]);
    assert.equal(challenges.length, 0);
  });

  it("handles unquoted values", () => {
    const challenges = parseWWWAuthenticate([
      "Payment method=tempo, intent=charge, id=ch_1, request=50000",
    ]);
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].method, "tempo");
    assert.equal(challenges[0].params.request, "50000");
  });

  it("accepts string input (single header value)", () => {
    const challenges = parseWWWAuthenticate(
      'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
    );
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].method, "tempo");
  });
});

describe("MPP 402 negotiation — execute()", () => {
  let server: http.Server;

  it("handles 402 then succeeds on paid retry", async () => {
    let callCount = 0;
    const mock = await createMockServer(async (req, res) => {
      callCount++;
      const body = await readBody(req);
      if (callCount === 1) {
        // First call — unpaid, return 402
        assert.equal(req.headers["authorization"], undefined);
        res.writeHead(402, {
          "WWW-Authenticate":
            'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ code: "payment_method_required" }));
      } else {
        // Second call — paid retry
        assert.ok(req.headers["authorization"]?.startsWith("Payment "));
        assert.ok(
          req.headers["authorization"]?.includes("tempo-credential-for-ch_1"),
        );
        // Verify same idempotency_key
        const parsed = JSON.parse(body);
        assert.equal(parsed.idempotency_key, "mpp-test-1");
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Payment-Receipt": "rcpt_abc_123",
        });
        res.end(JSON.stringify(successResult));
      }
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
    });

    const result = await agent.execute({
      service_id: "svc-1",
      payload: { prompt: "hello" },
      max_cost: 50000,
      idempotency_key: "mpp-test-1",
    });

    assert.equal(result.execution_id, "exec-1");
    assert.equal(result.payment_receipt, "rcpt_abc_123");
    assert.equal(callCount, 2);

    await closeServer(server);
  });

  it("handles renewed 402 (re-negotiation)", async () => {
    let callCount = 0;
    const mock = await createMockServer(async (_req, res) => {
      callCount++;
      if (callCount <= 2) {
        // First two calls return 402
        res.writeHead(402, {
          "WWW-Authenticate":
            `Payment method="tempo", intent="charge", id="ch_${callCount}", request="50000"`,
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ code: "payment_method_required" }));
      } else {
        // Third call succeeds
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(successResult));
      }
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
    });

    const result = await agent.execute({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "renew-1",
    });

    assert.equal(result.execution_id, "exec-1");
    assert.equal(callCount, 3);

    await closeServer(server);
  });

  it("throws PaymentRequiredError after max retries exceeded", async () => {
    const mock = await createMockServer(async (_req, res) => {
      res.writeHead(402, {
        "WWW-Authenticate":
          'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ code: "payment_method_required" }));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
      maxPaymentRetries: 2,
    });

    await assert.rejects(
      () =>
        agent.execute({
          service_id: "svc-1",
          payload: {},
          max_cost: 50000,
          idempotency_key: "exhaust-1",
        }),
      (err: unknown) => {
        assert.ok(err instanceof PaymentRequiredError);
        assert.equal(err.statusCode, 402);
        return true;
      },
    );

    await closeServer(server);
  });

  it("throws NoMatchingMethodError when no handler matches", async () => {
    const mock = await createMockServer(async (_req, res) => {
      res.writeHead(402, {
        "WWW-Authenticate":
          'Payment method="lightning", intent="charge", id="ch_1", request="50000"',
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ code: "payment_method_required" }));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler], // only tempo, server offers lightning
    });

    await assert.rejects(
      () =>
        agent.execute({
          service_id: "svc-1",
          payload: {},
          max_cost: 50000,
          idempotency_key: "nomatch-1",
        }),
      (err: unknown) => {
        assert.ok(err instanceof NoMatchingMethodError);
        assert.equal(err.challenges.length, 1);
        assert.equal(err.challenges[0].method, "lightning");
        return true;
      },
    );

    await closeServer(server);
  });

  it("throws PaymentRequiredError when no handlers configured", async () => {
    const mock = await createMockServer(async (_req, res) => {
      res.writeHead(402, {
        "WWW-Authenticate":
          'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ code: "payment_method_required" }));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      // no paymentHandlers
    });

    await assert.rejects(
      () =>
        agent.execute({
          service_id: "svc-1",
          payload: {},
          max_cost: 50000,
          idempotency_key: "nohandler-1",
        }),
      (err: unknown) => {
        assert.ok(err instanceof PaymentRequiredError);
        return true;
      },
    );

    await closeServer(server);
  });

  it("preserves idempotency_key across 402 retry", async () => {
    const receivedKeys: string[] = [];
    const mock = await createMockServer(async (req, res) => {
      const body = JSON.parse(await readBody(req));
      receivedKeys.push(body.idempotency_key);
      if (receivedKeys.length === 1) {
        res.writeHead(402, {
          "WWW-Authenticate":
            'Payment method="tempo", intent="charge", id="ch_1", request="50000"',
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ code: "payment_method_required" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(successResult));
      }
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
    });

    await agent.execute({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "idem-preserve-1",
    });

    assert.equal(receivedKeys.length, 2);
    assert.equal(receivedKeys[0], "idem-preserve-1");
    assert.equal(receivedKeys[1], "idem-preserve-1");

    await closeServer(server);
  });

  it("captures Payment-Receipt on direct success (no 402)", async () => {
    const mock = await createMockServer(async (_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Payment-Receipt": "rcpt_direct_123",
      });
      res.end(JSON.stringify(successResult));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
    });

    const result = await agent.execute({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "direct-receipt-1",
    });

    assert.equal(result.payment_receipt, "rcpt_direct_123");

    await closeServer(server);
  });

  it("selects preferred method over server order", async () => {
    let usedCredential = "";
    const mock = await createMockServer(async (req, res) => {
      const authz = req.headers["authorization"];
      if (!authz) {
        // Return two challenges — tempo first, stripe second
        res.writeHead(402, {
          "Content-Type": "application/json",
          "WWW-Authenticate": [
            'Payment method="tempo", intent="charge", id="ch_t", request="50000"',
            'Payment method="stripe", intent="charge", id="ch_s", request="50000"',
          ],
        });
        res.end(JSON.stringify({ code: "payment_method_required" }));
      } else {
        usedCredential = authz;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(successResult));
      }
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler, stripeHandler],
      preferredMethods: ["stripe"], // prefer stripe even though tempo is offered first
    });

    await agent.execute({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "prefer-1",
    });

    assert.ok(usedCredential.includes("stripe-credential-for-ch_s"));

    await closeServer(server);
  });

  it("works without MPP — no payment_receipt on non-402 response", async () => {
    const mock = await createMockServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(successResult));
    });
    server = mock.server;

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
    });

    const result = await agent.execute({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "nompp-1",
    });

    assert.equal(result.execution_id, "exec-1");
    assert.equal(result.payment_receipt, undefined);

    await closeServer(server);
  });
});

describe("MPP 402 negotiation — executeStream()", () => {
  it("handles 402 then streams on paid retry", async () => {
    let callCount = 0;
    const mock = await createMockServer(async (req, res) => {
      callCount++;
      if (callCount === 1) {
        // Unpaid — 402
        res.writeHead(402, {
          "WWW-Authenticate":
            'Payment method="tempo", intent="session", id="ch_stream", request="50000"',
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ code: "payment_method_required" }));
      } else {
        // Paid retry — SSE stream
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Payment-Receipt": "rcpt_stream_456",
        });
        res.write(
          'event: chunk\ndata: {"output":"partial","units_used":2,"cumulative_cost":10000}\n\n',
        );
        res.write(
          'event: done\ndata: {"execution_id":"exec-s","status":"completed","output":"final","units_used":5,"total_cost":50000,"platform_fee":1500,"provider_payout":0}\n\n',
        );
        res.end();
      }
    });

    const agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "om_live_test",
      paymentHandlers: [tempoHandler],
    });

    const stream = await agent.executeStream({
      service_id: "svc-1",
      payload: {},
      max_cost: 50000,
      idempotency_key: "stream-mpp-1",
    });

    assert.equal(stream.paymentReceipt, "rcpt_stream_456");

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    assert.equal(events.length, 2);
    assert.equal(events[0].type, "chunk");
    assert.equal(events[1].type, "done");
    assert.equal(callCount, 2);

    await closeServer(mock.server);
  });
});

import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as http from "node:http";
import { OpenMerchAgent, OpenMerchError } from "../src/client.js";
import type {
  BillingConfig,
  SetupIntentResult,
  CardInfo,
  CardListResponse,
} from "../src/types.js";

// --- Test helpers (same pattern as agent.test.ts) ---

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

const mockBillingConfig: BillingConfig = {
  publishable_key: "pk_test_abc123",
};

const mockSetupIntent: SetupIntentResult = {
  setup_intent_id: "seti_test_xyz",
  client_secret: "seti_test_xyz_secret_abc",
  status: "requires_payment_method",
};

const mockCard: CardInfo = {
  payment_method_id: "pm_test_card123",
  brand: "visa",
  last4: "4242",
  exp_month: 12,
  exp_year: 2030,
  is_default: true,
};

// --- Tests ---

describe("Billing", () => {
  let server: http.Server;
  let agent: OpenMerchAgent;

  afterEach(async () => {
    if (server) await closeServer(server);
  });

  it("getBillingConfig returns publishable key", async () => {
    const mock = await createMockServer((req, res) => {
      assert.equal(req.url, "/v1/billing/config");
      assert.equal(req.method, "GET");
      assert.equal(req.headers["x-openmerch-key"], "test-key");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockBillingConfig));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "test-key",
    });

    const config = await agent.getBillingConfig();
    assert.equal(config.publishable_key, "pk_test_abc123");
  });

  it("createCardSetupIntent sends POST with auth", async () => {
    const mock = await createMockServer((req, res) => {
      assert.equal(req.url, "/v1/billing/cards/setup-intent");
      assert.equal(req.method, "POST");
      assert.equal(req.headers["x-openmerch-key"], "test-key");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockSetupIntent));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "test-key",
    });

    const result = await agent.createCardSetupIntent();
    assert.equal(result.setup_intent_id, "seti_test_xyz");
    assert.equal(result.client_secret, "seti_test_xyz_secret_abc");
    assert.equal(result.status, "requires_payment_method");
  });

  it("confirmCardSetup sends setup_intent_id in body", async () => {
    const mock = await createMockServer(async (req, res) => {
      assert.equal(req.url, "/v1/billing/cards/confirm");
      assert.equal(req.method, "POST");
      const body = JSON.parse(await readBody(req));
      assert.equal(body.setup_intent_id, "seti_test_xyz");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockCard));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "test-key",
    });

    const card = await agent.confirmCardSetup("seti_test_xyz");
    assert.equal(card.payment_method_id, "pm_test_card123");
    assert.equal(card.brand, "visa");
    assert.equal(card.last4, "4242");
    assert.equal(card.is_default, true);
  });

  it("listCards returns cards array", async () => {
    const mockResponse: CardListResponse = { cards: [mockCard] };
    const mock = await createMockServer((req, res) => {
      assert.equal(req.url, "/v1/billing/cards");
      assert.equal(req.method, "GET");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockResponse));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "test-key",
    });

    const result = await agent.listCards();
    assert.equal(result.cards.length, 1);
    assert.equal(result.cards[0].brand, "visa");
    assert.equal(result.cards[0].last4, "4242");
  });

  it("listCards returns empty when no cards", async () => {
    const mock = await createMockServer((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cards: [] }));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "test-key",
    });

    const result = await agent.listCards();
    assert.equal(result.cards.length, 0);
  });

  it("throws OpenMerchError on 401", async () => {
    const mock = await createMockServer((req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "unauthorized", message: "invalid key" }));
    });
    server = mock.server;
    agent = new OpenMerchAgent({
      baseUrl: `http://127.0.0.1:${mock.port}`,
      apiKey: "bad-key",
    });

    await assert.rejects(
      () => agent.getBillingConfig(),
      (err: unknown) => {
        assert.ok(err instanceof OpenMerchError);
        assert.equal(err.statusCode, 401);
        return true;
      },
    );
  });
});

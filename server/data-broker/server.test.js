"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDataBrokerServer } = require("./server");
const { maskEmail, maskPhone, sanitizeCustomer, sanitizeOrders } = require("./sanitize");
const { createMockSourceServer } = require("../mock-source/server");

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("sanitize helpers mask direct identifiers", () => {
  assert.equal(maskEmail("lan.nguyen@acme.example"), "la********@acme.example");
  assert.equal(maskPhone("+84 912 345 678"), "***-***-5678");

  const customer = sanitizeCustomer({
    id: "cust_1",
    accountId: "acct_1",
    fullName: "Lan",
    email: "lan.nguyen@acme.example",
    phone: "+84 912 345 678",
    address: "12 Le Loi, District 1, Ho Chi Minh City",
    loyaltyTier: "gold",
    preferredCurrency: "VND",
    riskFlags: ["review"],
  });

  assert.equal(customer.contact.email, "la********@acme.example");
  assert.equal(customer.contact.phone, "***-***-5678");
  assert.equal(customer.contact.location, "District 1, Ho Chi Minh City");
  assert.deepEqual(customer.controls.sensitiveFieldsRemoved, [
    "nationalId",
    "internalNotes",
    "creditScoreBand",
    "address",
  ]);
});

test("sanitizeOrders strips internal-only fields", () => {
  const orders = sanitizeOrders([
    {
      id: "ord_1",
      createdAt: "2026-04-01T00:00:00Z",
      status: "delivered",
      amount: 100,
      currency: "USD",
      itemCount: 2,
      paymentMethod: "wire",
      marginPct: 0.31,
      internalTags: ["private"],
    },
  ]);

  assert.deepEqual(orders, [
    {
      orderId: "ord_1",
      createdAt: "2026-04-01T00:00:00Z",
      status: "delivered",
      amount: 100,
      currency: "USD",
      itemCount: 2,
      paymentMethod: "wire",
    },
  ]);
});

test("data broker returns redacted data from the upstream source", async (t) => {
  const sourceServer = createMockSourceServer({ apiKey: "source-test" });
  const sourceBaseUrl = await listen(sourceServer);
  t.after(() => sourceServer.close());

  const brokerServer = createDataBrokerServer({
    brokerToken: "broker-test",
    sourceBaseUrl,
    sourceToken: "source-test",
  });
  const brokerBaseUrl = await listen(brokerServer);
  t.after(() => brokerServer.close());

  const response = await fetch(`${brokerBaseUrl}/v1/customers/cust_acme_001/profile`, {
    headers: {
      authorization: "Bearer broker-test",
    },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.customer.customerId, "cust_acme_001");
  assert.equal(payload.customer.contact.email, "la********@acme.example");
  assert.equal(payload.customer.contact.phone, "***-***-5678");
  assert.equal(payload.customer.contact.location, "District 1, Ho Chi Minh City");
  assert.equal("nationalId" in payload.customer, false);
  assert.equal("internalNotes" in payload.customer, false);

  const ordersResponse = await fetch(`${brokerBaseUrl}/v1/customers/cust_acme_001/orders?limit=1`, {
    headers: {
      authorization: "Bearer broker-test",
    },
  });
  const ordersPayload = await ordersResponse.json();

  assert.equal(ordersPayload.orders.length, 1);
  assert.equal("marginPct" in ordersPayload.orders[0], false);
  assert.equal("internalTags" in ordersPayload.orders[0], false);
});

"use strict";

const http = require("node:http");
const { URL } = require("node:url");

const { findCustomer, findCustomerByAccountId } = require("./data");

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function unauthorized(res) {
  json(res, 401, {
    error: "unauthorized",
    message: "Missing or invalid source service credential.",
  });
}

function notFound(res, message) {
  json(res, 404, {
    error: "not_found",
    message,
  });
}

function buildCustomerEnvelope(customer) {
  return {
    customer,
    fetchedAt: new Date().toISOString(),
    source: "mock-internal-data-source",
  };
}

function handleRequest(req, res, options) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const apiKey = req.headers["x-source-api-key"];

  if (url.pathname === "/healthz") {
    return json(res, 200, { status: "ok", service: "mock-source" });
  }

  if (apiKey !== options.apiKey) {
    return unauthorized(res);
  }

  const customerMatch = url.pathname.match(/^\/internal\/customers\/([^/]+)$/);
  if (customerMatch) {
    const customer = findCustomer(decodeURIComponent(customerMatch[1]));
    if (!customer) {
      return notFound(res, "Customer not found.");
    }
    return json(res, 200, buildCustomerEnvelope(customer));
  }

  const ordersMatch = url.pathname.match(/^\/internal\/customers\/([^/]+)\/orders$/);
  if (ordersMatch) {
    const customer = findCustomer(decodeURIComponent(ordersMatch[1]));
    if (!customer) {
      return notFound(res, "Customer not found.");
    }
    const limit = Number(url.searchParams.get("limit") || customer.orders.length);
    return json(res, 200, {
      customerId: customer.id,
      accountId: customer.accountId,
      orders: customer.orders.slice(0, Number.isFinite(limit) && limit > 0 ? limit : customer.orders.length),
      fetchedAt: new Date().toISOString(),
      source: "mock-internal-data-source",
    });
  }

  const accountMatch = url.pathname.match(/^\/internal\/accounts\/([^/]+)\/summary$/);
  if (accountMatch) {
    const customer = findCustomerByAccountId(decodeURIComponent(accountMatch[1]));
    if (!customer) {
      return notFound(res, "Account not found.");
    }
    const totalSpend = customer.orders.reduce((sum, order) => sum + order.amount, 0);
    const activeOrders = customer.orders.filter((order) => order.status !== "cancelled").length;
    return json(res, 200, {
      accountId: customer.accountId,
      customerId: customer.id,
      accountOwner: customer.fullName,
      preferredCurrency: customer.preferredCurrency,
      totalSpend,
      activeOrders,
      averageMarginPct:
        customer.orders.length > 0
          ? customer.orders.reduce((sum, order) => sum + order.marginPct, 0) / customer.orders.length
          : 0,
      internalNotes: customer.internalNotes,
      riskFlags: customer.riskFlags,
      fetchedAt: new Date().toISOString(),
      source: "mock-internal-data-source",
    });
  }

  return notFound(res, "Unknown source route.");
}

function createMockSourceServer(options = {}) {
  const resolvedOptions = {
    apiKey: options.apiKey || process.env.MOCK_SOURCE_API_KEY || "source-secret",
  };

  return http.createServer((req, res) => handleRequest(req, res, resolvedOptions));
}

if (require.main === module) {
  const port = Number(process.env.MOCK_SOURCE_PORT || "3301");
  const server = createMockSourceServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`mock-source listening on http://0.0.0.0:${port}`);
  });
}

module.exports = {
  createMockSourceServer,
};

"use strict";

const http = require("node:http");
const { URL } = require("node:url");

const {
  sanitizeAccountSummary,
  sanitizeCustomer,
  sanitizeOrders,
} = require("./sanitize");

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const error = new Error(`Upstream request failed with HTTP ${response.status}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 20);
}

async function handleRequest(req, res, options) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    return json(res, 200, { status: "ok", service: "data-broker" });
  }

  if (readBearerToken(req) !== options.brokerToken) {
    return json(res, 401, {
      error: "unauthorized",
      message: "Missing or invalid Data Broker token.",
    });
  }

  if (url.pathname === "/v1/schema") {
    return json(res, 200, {
      service: "data-broker",
      purpose: "Filtered and redacted access layer for OpenClaw sandboxes.",
      routes: [
        {
          path: "/v1/customers/:customerId/profile",
          description: "Return a masked customer profile without direct identifiers.",
        },
        {
          path: "/v1/customers/:customerId/orders?limit=5",
          description: "Return curated order history without internal margin/tags.",
        },
        {
          path: "/v1/accounts/:accountId/summary",
          description: "Return a reporting-safe account summary.",
        },
      ],
      policy: {
        blockedFields: ["nationalId", "internalNotes", "creditScoreBand", "marginPct", "internalTags"],
        contract: "Use curated broker endpoints only. Do not bypass to raw source systems.",
      },
    });
  }

  try {
    const customerMatch = url.pathname.match(/^\/v1\/customers\/([^/]+)\/profile$/);
    if (customerMatch) {
      const customerId = decodeURIComponent(customerMatch[1]);
      const upstream = await fetchJson(`${options.sourceBaseUrl}/internal/customers/${encodeURIComponent(customerId)}`, {
        headers: {
          "x-source-api-key": options.sourceToken,
          accept: "application/json",
        },
      });

      return json(res, 200, {
        customer: sanitizeCustomer(upstream.customer),
        broker: {
          source: upstream.source,
          sanitizedAt: new Date().toISOString(),
        },
      });
    }

    const ordersMatch = url.pathname.match(/^\/v1\/customers\/([^/]+)\/orders$/);
    if (ordersMatch) {
      const customerId = decodeURIComponent(ordersMatch[1]);
      const limit = normalizeLimit(url.searchParams.get("limit"), 5);
      const upstream = await fetchJson(
        `${options.sourceBaseUrl}/internal/customers/${encodeURIComponent(customerId)}/orders?limit=${limit}`,
        {
          headers: {
            "x-source-api-key": options.sourceToken,
            accept: "application/json",
          },
        },
      );

      return json(res, 200, {
        customerId: upstream.customerId,
        accountId: upstream.accountId,
        orders: sanitizeOrders(upstream.orders),
        broker: {
          source: upstream.source,
          sanitizedAt: new Date().toISOString(),
          removedFields: ["marginPct", "internalTags"],
        },
      });
    }

    const summaryMatch = url.pathname.match(/^\/v1\/accounts\/([^/]+)\/summary$/);
    if (summaryMatch) {
      const accountId = decodeURIComponent(summaryMatch[1]);
      const upstream = await fetchJson(
        `${options.sourceBaseUrl}/internal/accounts/${encodeURIComponent(accountId)}/summary`,
        {
          headers: {
            "x-source-api-key": options.sourceToken,
            accept: "application/json",
          },
        },
      );

      return json(res, 200, {
        summary: sanitizeAccountSummary(upstream),
        broker: {
          source: upstream.source,
          sanitizedAt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    const statusCode = error.statusCode || 502;
    return json(res, statusCode, {
      error: "upstream_failure",
      message: error.payload?.message || error.message || "Failed to read source data.",
    });
  }

  return json(res, 404, {
    error: "not_found",
    message: "Unknown broker route.",
  });
}

function createDataBrokerServer(options = {}) {
  const resolvedOptions = {
    brokerToken: options.brokerToken || process.env.DATA_BROKER_TOKEN || "broker-secret",
    sourceBaseUrl: (options.sourceBaseUrl || process.env.DATA_BROKER_SOURCE_BASE_URL || "http://127.0.0.1:3301").replace(/\/$/, ""),
    sourceToken: options.sourceToken || process.env.DATA_BROKER_SOURCE_TOKEN || "source-secret",
  };

  return http.createServer((req, res) => {
    void handleRequest(req, res, resolvedOptions);
  });
}

if (require.main === module) {
  const port = Number(process.env.DATA_BROKER_PORT || "3302");
  const server = createDataBrokerServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`data-broker listening on http://0.0.0.0:${port}`);
  });
}

module.exports = {
  createDataBrokerServer,
};

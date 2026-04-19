"use strict";

const http = require("node:http");
const { Readable } = require("node:stream");
const { URL } = require("node:url");

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

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function requireOption(value, name) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`Missing required configuration: ${name}`);
}

function buildGatewayOptions(options = {}) {
  const callerToken = options.callerToken ?? process.env.MODEL_GATEWAY_TOKEN;
  const upstreamBaseUrl = options.upstreamBaseUrl ?? process.env.MODEL_GATEWAY_UPSTREAM_BASE_URL;
  const upstreamApiKey = options.upstreamApiKey ?? process.env.MODEL_GATEWAY_UPSTREAM_API_KEY;
  const allowedModels = options.allowedModels ?? parseCsv(process.env.MODEL_GATEWAY_ALLOWED_MODELS);
  const upstreamTimeoutMs = Number(
    options.upstreamTimeoutMs ?? process.env.MODEL_GATEWAY_UPSTREAM_TIMEOUT_MS ?? "30000",
  );

  return {
    callerToken: requireOption(callerToken, "MODEL_GATEWAY_TOKEN"),
    upstreamBaseUrl: requireOption(upstreamBaseUrl, "MODEL_GATEWAY_UPSTREAM_BASE_URL").replace(/\/$/, ""),
    upstreamApiKey: requireOption(upstreamApiKey, "MODEL_GATEWAY_UPSTREAM_API_KEY"),
    allowedModels: Array.isArray(allowedModels) ? allowedModels.filter(Boolean) : [],
    upstreamTimeoutMs:
      Number.isFinite(upstreamTimeoutMs) && upstreamTimeoutMs > 0 ? upstreamTimeoutMs : 30000,
  };
}

function buildModelsResponse(options) {
  const data = options.allowedModels.map((modelId) => ({
    id: modelId,
    object: "model",
    created: 0,
    owned_by: "model-gateway",
  }));
  return {
    object: "list",
    data,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8").trim();
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function filterProxyResponseHeaders(headers) {
  const responseHeaders = {};
  for (const [key, value] of headers.entries()) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === "content-type" ||
      normalizedKey === "cache-control" ||
      normalizedKey === "x-request-id" ||
      normalizedKey === "openai-processing-ms"
    ) {
      responseHeaders[normalizedKey] = value;
    }
  }
  return responseHeaders;
}

async function proxyJsonRequest(req, res, options, upstreamPath) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch {
    return json(res, 400, {
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    });
  }

  const requestedModel = String(payload.model || "").trim();
  if (!requestedModel) {
    return json(res, 400, {
      error: "invalid_request",
      message: "A model id is required.",
    });
  }

  if (options.allowedModels.length > 0 && !options.allowedModels.includes(requestedModel)) {
    return json(res, 403, {
      error: "model_not_allowed",
      message: `Model '${requestedModel}' is not exposed by the internal model gateway.`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.upstreamTimeoutMs);

  try {
    const upstreamResponse = await fetch(`${options.upstreamBaseUrl}${upstreamPath}`, {
      method: "POST",
      headers: {
        accept: req.headers.accept || "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${options.upstreamApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    res.writeHead(upstreamResponse.status, filterProxyResponseHeaders(upstreamResponse.headers));

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstreamResponse.body).pipe(res);
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error && typeof error === "object" && error.name === "AbortError"
        ? "Upstream model provider timed out."
        : "Failed to reach upstream model provider.";
    return json(res, 502, {
      error: "upstream_failure",
      message,
    });
  }
}

async function handleRequest(req, res, options) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    return json(res, 200, {
      status: "ok",
      service: "model-gateway",
      models: options.allowedModels,
    });
  }

  if (readBearerToken(req) !== options.callerToken) {
    return json(res, 401, {
      error: "unauthorized",
      message: "Missing or invalid internal model gateway token.",
    });
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    return json(res, 200, buildModelsResponse(options));
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    return proxyJsonRequest(req, res, options, "/v1/chat/completions");
  }

  if (req.method === "POST" && url.pathname === "/v1/responses") {
    return proxyJsonRequest(req, res, options, "/v1/responses");
  }

  return json(res, 404, {
    error: "not_found",
    message: "Unknown model gateway route.",
  });
}

function createModelGatewayServer(options = {}) {
  const resolvedOptions = buildGatewayOptions(options);

  return http.createServer((req, res) => {
    void handleRequest(req, res, resolvedOptions);
  });
}

if (require.main === module) {
  const port = Number(process.env.MODEL_GATEWAY_PORT || "3401");
  const server = createModelGatewayServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`model-gateway listening on http://0.0.0.0:${port}`);
  });
}

module.exports = {
  buildGatewayOptions,
  createModelGatewayServer,
};

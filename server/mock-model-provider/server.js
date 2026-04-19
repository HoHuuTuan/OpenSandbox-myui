"use strict";

const http = require("node:http");
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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleRequest(req, res, options) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    return json(res, 200, { status: "ok", service: "mock-model-provider" });
  }

  if (readBearerToken(req) !== options.apiKey) {
    return json(res, 401, {
      error: "unauthorized",
      message: "Missing or invalid mock model provider credential.",
    });
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    return json(res, 200, {
      object: "list",
      data: options.models.map((modelId) => ({
        id: modelId,
        object: "model",
        created: 0,
        owned_by: "mock-model-provider",
      })),
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    const payload = await readJsonBody(req);
    const model = payload.model || options.models[0];
    const lastUserMessage = Array.isArray(payload.messages)
      ? payload.messages
          .filter((message) => message && message.role === "user")
          .map((message) => {
            const content = message.content;
            if (typeof content === "string") {
              return content;
            }
            return Array.isArray(content)
              ? content
                  .map((part) => (typeof part?.text === "string" ? part.text : ""))
                  .join(" ")
                  .trim()
              : "";
          })
          .filter(Boolean)
          .pop() || "no-user-message"
      : "no-user-message";

    if (payload.stream) {
      const chunks = [
        {
          id: "chatcmpl_mock_stream",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { role: "assistant", content: "internal " }, finish_reason: null }],
        },
        {
          id: "chatcmpl_mock_stream",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { content: `reply: ${lastUserMessage}` }, finish_reason: null }],
        },
        {
          id: "chatcmpl_mock_stream",
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        },
      ];

      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end("data: [DONE]\n\n");
      return;
    }

    return json(res, 200, {
      id: "chatcmpl_mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: `internal reply: ${lastUserMessage}`,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });
  }

  return json(res, 404, {
    error: "not_found",
    message: "Unknown mock model provider route.",
  });
}

function createMockModelProviderServer(options = {}) {
  const resolvedOptions = {
    apiKey: options.apiKey || process.env.MOCK_MODEL_PROVIDER_API_KEY || "model-upstream-secret",
    models:
      options.models ||
      String(process.env.MOCK_MODEL_PROVIDER_MODELS || "mock-gpt-oss-mini")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
  };

  return http.createServer((req, res) => {
    void handleRequest(req, res, resolvedOptions);
  });
}

if (require.main === module) {
  const port = Number(process.env.MOCK_MODEL_PROVIDER_PORT || "3501");
  const server = createMockModelProviderServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`mock-model-provider listening on http://0.0.0.0:${port}`);
  });
}

module.exports = {
  createMockModelProviderServer,
};

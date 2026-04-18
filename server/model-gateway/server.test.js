"use strict";

const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createModelGatewayServer } = require("./server");

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function createUpstreamServer() {
  let lastAuthHeader = "";
  let lastModel = "";

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const payload = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};

    lastAuthHeader = String(req.headers.authorization || "");
    lastModel = String(payload.model || "");

    if (req.url === "/v1/chat/completions") {
      if (payload.stream) {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
        });
        res.write(
          'data: {"id":"chatcmpl_mock","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"mock"},"finish_reason":null}]}\n\n',
        );
        res.write('data: {"id":"chatcmpl_mock","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n');
        res.end("data: [DONE]\n\n");
        return;
      }

      const body = JSON.stringify({
        id: "chatcmpl_mock",
        object: "chat.completion",
        created: 1,
        model: payload.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "mock-response",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
        },
      });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    res.writeHead(404).end();
  });

  return {
    server,
    getLastAuthHeader: () => lastAuthHeader,
    getLastModel: () => lastModel,
  };
}

test("model gateway enforces caller auth and forwards with separate upstream auth", async (t) => {
  const upstream = createUpstreamServer();
  const upstreamBaseUrl = await listen(upstream.server);
  t.after(() => upstream.server.close());

  const gateway = createModelGatewayServer({
    callerToken: "internal-token",
    upstreamBaseUrl,
    upstreamApiKey: "upstream-secret",
    allowedModels: ["mock/gpt-oss-mini"],
  });
  const gatewayBaseUrl = await listen(gateway);
  t.after(() => gateway.close());

  const unauthorized = await fetch(`${gatewayBaseUrl}/v1/models`);
  assert.equal(unauthorized.status, 401);

  const completion = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer internal-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mock/gpt-oss-mini",
      messages: [{ role: "user", content: "hello" }],
    }),
  });

  assert.equal(completion.status, 200);
  const payload = await completion.json();
  assert.equal(payload.choices[0].message.content, "mock-response");
  assert.equal(upstream.getLastAuthHeader(), "Bearer upstream-secret");
  assert.equal(upstream.getLastModel(), "mock/gpt-oss-mini");
});

test("model gateway blocks models outside the internal allowlist", async (t) => {
  const upstream = createUpstreamServer();
  const upstreamBaseUrl = await listen(upstream.server);
  t.after(() => upstream.server.close());

  const gateway = createModelGatewayServer({
    callerToken: "internal-token",
    upstreamBaseUrl,
    upstreamApiKey: "upstream-secret",
    allowedModels: ["mock/gpt-oss-mini"],
  });
  const gatewayBaseUrl = await listen(gateway);
  t.after(() => gateway.close());

  const response = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer internal-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mock/not-exposed",
      messages: [{ role: "user", content: "hello" }],
    }),
  });

  assert.equal(response.status, 403);
});

test("model gateway preserves streaming responses", async (t) => {
  const upstream = createUpstreamServer();
  const upstreamBaseUrl = await listen(upstream.server);
  t.after(() => upstream.server.close());

  const gateway = createModelGatewayServer({
    callerToken: "internal-token",
    upstreamBaseUrl,
    upstreamApiKey: "upstream-secret",
    allowedModels: ["mock/gpt-oss-mini"],
  });
  const gatewayBaseUrl = await listen(gateway);
  t.after(() => gateway.close());

  const response = await fetch(`${gatewayBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: "Bearer internal-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mock/gpt-oss-mini",
      stream: true,
      messages: [{ role: "user", content: "hello" }],
    }),
  });

  assert.equal(response.status, 200);
  assert.match(String(response.headers.get("content-type")), /text\/event-stream/i);

  const text = await response.text();
  assert.match(text, /\[DONE\]/);
  assert.match(text, /mock/);
});

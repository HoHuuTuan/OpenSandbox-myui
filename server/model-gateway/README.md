# Model Gateway

`server/model-gateway` is the internal OpenAI-compatible proxy that OpenClaw sandboxes use instead of talking to public model providers directly.

## Responsibilities

- authenticate sandbox requests with an internal gateway token
- enforce an allowlist of exposed model ids
- forward requests to the upstream model provider with a separate upstream credential
- keep upstream credentials out of OpenClaw sandboxes

## Routes

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`

## Required environment

- `MODEL_GATEWAY_TOKEN`
- `MODEL_GATEWAY_UPSTREAM_BASE_URL`
- `MODEL_GATEWAY_UPSTREAM_API_KEY`
- `MODEL_GATEWAY_ALLOWED_MODELS`

## Test

```bash
node --test server/model-gateway/server.test.js
```

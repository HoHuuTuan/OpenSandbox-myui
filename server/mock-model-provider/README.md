# Mock Model Provider

`server/mock-model-provider` is a minimal OpenAI-compatible upstream used for local verification of the internal `model-gateway`.

It exists so the local compose stack can validate:

`OpenClaw sandbox -> model-gateway -> upstream model provider`

without requiring a real external model API key during local development.

## Routes

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

All non-health routes require:

```http
Authorization: Bearer model-upstream-secret
```

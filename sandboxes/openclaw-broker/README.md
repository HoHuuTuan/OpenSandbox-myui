# OpenClaw Trust-Boundary Sandbox

This image wraps the official `ghcr.io/openclaw/openclaw:latest` image with a role-aware entrypoint so the same sandbox image can boot either trust boundary:

- `public-web`: browser enabled, public-web tasks only, no internal data access
- `private-data`: browser disabled, broker-only internal data access, no direct DB/raw source access

The intended deployment topology is:

`OpenClaw sandbox -> model-gateway -> upstream model provider`

`OpenClaw private-data sandbox -> data-broker -> private source`

## What this image adds

- `broker-query` helper at `/usr/local/bin/broker-query`
- role profiles under `/opt/opensandbox/profiles/public-web` and `/opt/opensandbox/profiles/private-data`
- startup entrypoint that writes `~/.openclaw/openclaw.json`
- support for an internal OpenAI-compatible `model-gateway`

## Build

```bash
cd sandboxes/openclaw-broker
docker build -t opensandbox/openclaw-broker:latest .
```

## Runtime environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCLAW_TRUST_ROLE` | `private-data` | Trust boundary profile: `public-web` or `private-data` |
| `OPENCLAW_GATEWAY_PORT` | `8080` | Port exposed by the OpenClaw gateway |
| `OPENCLAW_GATEWAY_TOKEN` | required | Gateway auth token. Do not reuse across trust boundaries |
| `OPENCLAW_GATEWAY_ALLOWED_ORIGINS` | `http://127.0.0.1:8090,http://localhost:8090` | Comma-separated Control UI origin allowlist |
| `OPENCLAW_TOOLS_PROFILE` | `coding` | OpenClaw tool profile |
| `OPENCLAW_MODEL_GATEWAY_URL` | empty | Internal OpenAI-compatible model gateway base URL, usually `http://model-gateway:3401/v1` |
| `OPENCLAW_MODEL_GATEWAY_TOKEN` | empty | Bearer token sent to the internal model gateway |
| `OPENCLAW_MODEL_PROVIDER_ID` | `internal-model` | Provider id injected into `openclaw.json` |
| `OPENCLAW_MODEL_ID` | `mock-gpt-oss-mini` | Model id exposed by the internal model gateway |
| `OPENCLAW_MODEL_NAME` | `Internal Mock GPT OSS Mini` | Human-readable model name |
| `OPENCLAW_PRIMARY_MODEL` | empty | Optional direct model ref if you do not use `model-gateway` |
| `OPENCLAW_DATA_BROKER_URL` | `http://data-broker:3302` | Internal Data Broker URL for the private-data boundary |
| `OPENCLAW_DATA_BROKER_TOKEN` | empty | Bearer token used by `broker-query` |

`OPENCLAW_GATEWAY_TOKEN` is now required explicitly so the image does not start with a shared demo secret. Override `OPENCLAW_GATEWAY_ALLOWED_ORIGINS` when exposing the gateway behind a different domain or reverse proxy.

## Included helper

```bash
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

`broker-query` is intended for the `private-data` boundary only and always calls the Data Broker instead of the raw source.

## Lifecycle API note

The lifecycle API in this repo still requires an explicit `entrypoint` in create-sandbox requests. Use:

```bash
/opt/opensandbox/openclaw-entrypoint.sh
```

The admin templates and `examples/openclaw/main.py` already send that value.

## Related services

For local end-to-end development, pair this image with:

- [server/model-gateway/server.js](../../server/model-gateway/server.js)
- [server/mock-model-provider/server.js](../../server/mock-model-provider/server.js)
- [server/data-broker/server.js](../../server/data-broker/server.js)
- [server/mock-source/server.js](../../server/mock-source/server.js)

All four are wired in [server/docker-compose.yaml](../../server/docker-compose.yaml).

# OpenClaw Broker Sandbox

This sandbox image wraps the official `ghcr.io/openclaw/openclaw:latest` image with a broker-first workspace and helper scripts so OpenClaw can fetch sanitized data through an internal Data Broker instead of talking to raw data sources directly.

## What this image adds

- `broker-query` helper at `/usr/local/bin/broker-query`
- Pre-seeded OpenClaw workspace files under `/workspace`
- Startup entrypoint that writes `~/.openclaw/openclaw.json`
- Default OpenClaw tool profile set to `coding` so the runtime can use shell tools

## Build

```bash
cd sandboxes/openclaw-broker
docker build -t opensandbox/openclaw-broker:latest .
```

## Runtime environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENCLAW_GATEWAY_PORT` | `8080` | Port exposed by the OpenClaw gateway |
| `OPENCLAW_GATEWAY_TOKEN` | `123456` | Gateway auth token |
| `OPENCLAW_TOOLS_PROFILE` | `coding` | OpenClaw tool profile |
| `OPENCLAW_DATA_BROKER_URL` | `http://host.docker.internal:3302` | Internal Data Broker base URL |
| `OPENCLAW_DATA_BROKER_TOKEN` | `broker-secret` | Bearer token used by `broker-query` |

## Included helper

```bash
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

The helper always calls the Data Broker, never the raw source service.

## Lifecycle API note

The lifecycle API in this repo currently requires an explicit `entrypoint` in create-sandbox requests. Use:

```bash
/opt/opensandbox/openclaw-entrypoint.sh
```

The admin template and `examples/openclaw/main.py` already send that value.

## Workspace policy

The preloaded [AGENTS.md](workspace/AGENTS.md) and [TOOLS.md](workspace/TOOLS.md) instruct OpenClaw to:

- use `broker-query` first for customer/account data
- never bypass the Data Broker to raw data sources
- treat missing fields as a contract issue, not a reason to reach around the broker

## Related services

For local end-to-end development, pair this image with:

- `server/mock-source/server.js`
- `server/data-broker/server.js`

Both are wired in [server/docker-compose.yaml](../../server/docker-compose.yaml).

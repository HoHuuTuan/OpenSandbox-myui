# OpenClaw Dual-Boundary Example

This example launches an [OpenClaw](https://github.com/openclaw/openclaw) gateway inside OpenSandbox with two clean trust boundaries:

- `public-web`: web/public research only
- `private-data`: internal reporting data only through `data-broker`

The standard data path is:

`OpenClaw private-data sandbox -> Data Broker -> private source`

The standard model path is:

`OpenClaw sandbox -> model-gateway -> upstream model provider`

No OpenClaw sandbox receives raw database credentials or talks to a raw source directly.

## Local end-to-end flow

### 1. Build the OpenClaw image

```shell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

### 2. Start OpenSandbox and internal services

```shell
cd server
docker compose up --build
```

This compose stack starts:

- `opensandbox-server` on `http://localhost:8090`
- `model-gateway` on the internal Docker network
- `mock-model-provider` on the internal Docker network
- `data-broker` on the internal Docker network
- `mock-source` on the internal Docker network

### 3. Install Python dependencies

```shell
uv pip install opensandbox requests
```

### 4. Launch the desired trust boundary

Private-data boundary:

```shell
OPENCLAW_ROLE=private-data uv run python examples/openclaw/main.py
```

Public-web boundary:

```shell
OPENCLAW_ROLE=public-web uv run python examples/openclaw/main.py
```

Expected output:

```text
Creating OpenClaw sandbox with image=opensandbox/openclaw-broker:latest on http://localhost:8090...
  Trust boundary: private-data
[check] sandbox ready after 7.1s
OpenClaw is ready.
  Gateway endpoint: http://127.0.0.1:56123
  Connect flow: open the direct gateway endpoint above in your browser.
  Auth flow: paste OPENCLAW_GATEWAY_TOKEN into the Control UI when prompted.
  Avoid using /v1/sandboxes/<id>/proxy/8080 for OpenClaw Control UI unless you intend to pair that browser.
  Sandbox trust boundary: private-data
  Sandbox data access mode: broker-only
```

To connect successfully in local development:

1. Open the printed `Gateway endpoint` directly, for example `http://127.0.0.1:56123`.
2. Paste the same `OPENCLAW_GATEWAY_TOKEN` that you injected into the sandbox.
3. Do not use the lifecycle proxy URL for Control UI if your goal is a local loopback connection without pairing.

When the sandbox is created through this repo's lifecycle server with `networkPolicy`, the server also auto-adds the exact direct dashboard origins (such as `http://localhost:<port>` and `http://127.0.0.1:<port>`) into `gateway.controlUi.allowedOrigins`, so the direct dashboard should not fail with `origin not allowed`.

## Default configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_SERVER` | `http://localhost:8090` | OpenSandbox server URL for this repo's compose stack |
| `OPENCLAW_IMAGE` | `opensandbox/openclaw-broker:latest` | Trust-boundary sandbox image |
| `OPENCLAW_ROLE` | `private-data` | Boundary profile: `public-web` or `private-data` |
| `OPENCLAW_TIMEOUT` | `3600` | Sandbox timeout in seconds |
| `OPENCLAW_TOKEN` | `dummy-token-for-sandbox` | Default gateway token fallback |
| `OPENCLAW_GATEWAY_TOKEN` | `dummy-token-for-sandbox` | Gateway token passed into the sandbox |
| `OPENCLAW_PORT` | `8080` | OpenClaw gateway port inside the sandbox |
| `OPENCLAW_MODEL_GATEWAY_URL` | `http://model-gateway:3401/v1` | Internal model gateway |
| `OPENCLAW_MODEL_GATEWAY_TOKEN` | `model-gateway-local-token` | Bearer token used by the sandbox |
| `OPENCLAW_MODEL_PROVIDER_ID` | `internal-model` | Provider id injected into OpenClaw config |
| `OPENCLAW_MODEL_ID` | `gemini-2.5-flash` | Model id exposed by the internal model gateway |
| `OPENCLAW_DATA_BROKER_URL` | `http://data-broker:3302` | Broker URL for the private-data boundary |
| `OPENCLAW_DATA_BROKER_TOKEN` | `broker-local-token` | Bearer token used by `broker-query` |
| `OPENCLAW_ALLOWED_EGRESS` | role-specific allowlist | Optional override for additional allowed hosts |

## Role-specific egress defaults

`public-web`:

- `model-gateway`
- `github.com`
- `api.github.com`
- `developer.mozilla.org`
- `docs.python.org`

`private-data`:

- `model-gateway`
- `data-broker`

Override the allowlist with:

```shell
export OPENCLAW_ALLOWED_EGRESS="model-gateway,data-broker"
```

## Broker contract

The private-data profile seeds `/workspace/AGENTS.md` and `/workspace/TOOLS.md` so the OpenClaw agent is instructed to:

- run `broker-query schema` first
- call broker routes instead of raw source systems
- stop and report missing fields instead of bypassing the broker

Supported helper commands inside the private-data sandbox:

```shell
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

## References

- [OpenClaw](https://github.com/openclaw/openclaw)
- [OpenSandbox Python SDK](https://pypi.org/project/opensandbox/)
- [Trust-boundary sandbox image](../../sandboxes/openclaw-broker/README.md)

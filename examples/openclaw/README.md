# OpenClaw Broker-First Example

Launch an [OpenClaw](https://github.com/openclaw/openclaw) gateway inside OpenSandbox with a broker-only data path:

`OpenClaw sandbox -> Data Broker -> private source`

The sandbox never receives raw source credentials and does not connect to a database directly. The Data Broker uses its own upstream credential, filters the response, and returns only curated data.

## Local end-to-end flow

### 1. Build the broker-first OpenClaw image

```shell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

### 2. Start OpenSandbox, mock source, and Data Broker

```shell
cd server
docker compose up --build
```

This compose stack starts:

- `opensandbox-server` on `http://localhost:8090`
- `mock-source` on the internal compose network
- `data-broker` on `http://localhost:3302`

### 3. Install Python dependencies

```shell
uv pip install opensandbox requests
```

### 4. Launch the example

```shell
uv run python examples/openclaw/main.py
```

Expected output:

```text
Creating broker-first OpenClaw sandbox with image=opensandbox/openclaw-broker:latest on http://localhost:8090...
[check] sandbox ready after 7.1s
OpenClaw is ready.
  Gateway endpoint: http://127.0.0.1:56123
  Sandbox data access mode: broker-only
```

## Default configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_SERVER` | `http://localhost:8090` | OpenSandbox server URL for this repo's compose stack |
| `OPENCLAW_IMAGE` | `opensandbox/openclaw-broker:latest` | Broker-first sandbox image |
| `OPENCLAW_TIMEOUT` | `3600` | Sandbox timeout in seconds |
| `OPENCLAW_TOKEN` | `dummy-token-for-sandbox` | Default gateway token fallback |
| `OPENCLAW_GATEWAY_TOKEN` | `dummy-token-for-sandbox` | Gateway token passed into the sandbox |
| `OPENCLAW_PORT` | `8080` | OpenClaw gateway port inside the sandbox |
| `OPENCLAW_DATA_BROKER_URL` | `http://host.docker.internal:3302` | Broker URL reachable from bridge-mode sandboxes |
| `OPENCLAW_DATA_BROKER_TOKEN` | `broker-secret` | Bearer token used by the sandbox helper |
| `OPENCLAW_ALLOWED_EGRESS` | built-in allowlist | Comma-separated extra hosts if your model provider differs |

If you run the upstream `opensandbox-server` outside this repo and it listens on `http://localhost:8080`, override `OPENCLAW_SERVER` before running the example.

## Network policy

The example uses a deny-by-default egress policy and only allows the hosts OpenClaw usually needs:

- `host.docker.internal` for the Data Broker
- `api.openai.com`
- `api.anthropic.com`
- `openrouter.ai`
- `github.com`
- `api.github.com`

Override the allowlist with:

```shell
export OPENCLAW_ALLOWED_EGRESS="host.docker.internal,api.openai.com,my-model-gateway.internal"
```

## Broker contract

The broker image seeds `/workspace/AGENTS.md` and `/workspace/TOOLS.md` so the OpenClaw agent is instructed to:

- use `broker-query schema` first
- call broker routes instead of raw source systems
- stop and report missing fields instead of bypassing the broker

The current lifecycle API in this repo still requires an explicit `entrypoint`, so the example sends:

```shell
/opt/opensandbox/openclaw-entrypoint.sh
```

Supported helper commands inside the sandbox:

```shell
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

## References

- [OpenClaw](https://github.com/openclaw/openclaw)
- [OpenSandbox Python SDK](https://pypi.org/project/opensandbox/)
- [Broker sandbox image](../../sandboxes/openclaw-broker/README.md)

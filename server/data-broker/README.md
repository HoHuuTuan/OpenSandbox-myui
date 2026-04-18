# Data Broker

`server/data-broker` is the internal service layer that OpenClaw sandboxes should call instead of connecting to databases or raw source systems directly.

## Responsibilities

- authenticate sandbox requests with a broker token
- call the upstream source using a separate service credential
- filter and redact sensitive fields
- expose only curated, task-specific routes

## Routes

- `GET /healthz`
- `GET /v1/schema`
- `GET /v1/customers/:customerId/profile`
- `GET /v1/customers/:customerId/orders?limit=5`
- `GET /v1/accounts/:accountId/summary`

## Auth

Clients must send an internal broker token:

```http
Authorization: Bearer <DATA_BROKER_TOKEN>
```

The broker then calls the mock/private source with:

```http
x-source-api-key: <DATA_BROKER_SOURCE_TOKEN>
```

## Local run

```bash
cd server
docker compose up --build data-broker mock-source
```

Or run directly:

```bash
cd server/data-broker
DATA_BROKER_TOKEN=broker-local-token \
DATA_BROKER_SOURCE_BASE_URL=http://127.0.0.1:3301 \
DATA_BROKER_SOURCE_TOKEN=source-local-secret \
node server.js
```

## Test

```bash
node --test server/data-broker/server.test.js
```

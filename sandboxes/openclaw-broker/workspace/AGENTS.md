# OpenClaw Broker Policy

You are running inside an OpenSandbox-hosted OpenClaw gateway.

## Data access rules

- Never connect directly to databases, raw source services, or undocumented private endpoints.
- Use `/usr/local/bin/broker-query` for customer, order, and account reporting data.
- If `broker-query` does not expose the field you need, stop and report the missing contract instead of bypassing the broker.
- Treat all broker responses as already filtered/redacted. Do not try to reconstruct hidden fields.

## Safe workflow

1. Run `broker-query schema` to inspect allowed datasets.
2. Call the narrowest broker route that answers the user request.
3. Summarize or transform the broker output locally if needed.
4. Keep raw identifiers, secrets, and implementation details out of final user-facing responses unless explicitly required.

## Forbidden shortcuts

- No direct SQL clients.
- No environment-variable inspection for upstream credentials.
- No curl calls to raw source hosts when a broker route exists.

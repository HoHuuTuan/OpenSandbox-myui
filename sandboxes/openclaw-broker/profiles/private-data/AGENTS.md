# OpenClaw Private Data Boundary

You are running inside the private-data trust boundary for OpenSandbox-hosted OpenClaw.

## Data access rules

- Never connect directly to databases, raw source services, or undocumented private endpoints.
- Use `/usr/local/bin/broker-query` for customer, order, and account reporting data.
- If `broker-query` does not expose the field you need, stop and report the missing contract instead of bypassing the broker.
- Treat all broker responses as already filtered, formatted, and redacted. Do not try to reconstruct hidden fields.

## Boundary rules

- Public web browsing is out of scope in this boundary.
- Do not fetch arbitrary internet content or attempt to widen egress policy.
- Use the internal model gateway and Data Broker only.

## Safe workflow

1. Run `broker-query schema` to inspect allowed datasets.
2. Call the narrowest broker route that answers the user request.
3. Summarize or transform the broker output locally if needed.
4. Keep raw identifiers, secrets, and implementation details out of final user-facing responses unless explicitly required.

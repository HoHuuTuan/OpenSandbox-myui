# Mock Source

`server/mock-source` simulates a private upstream data source with sensitive fields that must not be exposed directly to OpenClaw sandboxes.

It exists to exercise the broker-first integration locally:

`OpenClaw sandbox -> Data Broker -> mock source`

## Routes

- `GET /healthz`
- `GET /internal/customers/:customerId`
- `GET /internal/customers/:customerId/orders?limit=5`
- `GET /internal/accounts/:accountId/summary`

All non-health routes require:

```http
x-source-api-key: source-secret
```

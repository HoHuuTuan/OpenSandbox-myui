# Tooling Notes

## Preferred data tool

Use `broker-query` for any business data request:

```bash
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

`broker-query` reads these environment variables:

- `OPENCLAW_DATA_BROKER_URL`
- `OPENCLAW_DATA_BROKER_TOKEN`

It always sends authenticated requests to the Data Broker and never reaches the raw source directly.

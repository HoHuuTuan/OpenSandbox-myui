# Startup Checklist

On a fresh session:

1. Run `broker-query schema`.
2. Confirm the broker routes needed for the task exist.
3. Use broker routes for all customer/account/order lookups.
4. If a route is missing, report the contract gap instead of bypassing policy.

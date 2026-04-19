# Tooling Notes

## Allowed focus

- Browser and shell tools are available for public-web tasks.
- `broker-query` may exist in the image, but this boundary is not authorized to use internal data services.

## Escalation rule

If the user asks for company-internal customer, account, order, or reporting data, hand off the request to a private-data gateway instead of attempting internal access from this sandbox.

# Correctness: `SUM_WITH_MULTIPLIER` accepts a zero multiplier

**Type:** product / billing correctness
**Severity:** high: silent under-billing
**Found:** 2026-09-23, during the V2 Features migration
**Owner:** backend / product (not the frontend migration)

Filed separately on purpose. V2 fixing its own validation does **not** fix
existing V1-created data, and does not guarantee every creation path is
protected.

## What happens

`flexprice-front/src/pages/product-catalog/features/AddFeature.tsx`:

```ts
if (!meterData.aggregation?.multiplier || meterData.aggregation.multiplier <= 0) {
  errors.aggregation_multiplier = 'Multiplier must be greater than 0'
}
```

`multiplier` is a **string** on the wire. `'0' <= 0` is `false` in JavaScript,
and `'0'` is truthy, so neither branch fires.

```
SUM_WITH_MULTIPLIER
multiplier = "0"
        ↓
V1 validation:  "0" <= 0  ->  false
        ↓
feature accepted
        ↓
usage × 0
        ↓
$0 billed
```

## Why it needs its own ticket

- **Existing data.** Any feature already created this way is still billing zero.
  Needs a query against live meters for `SUM_WITH_MULTIPLIER` with a
  non-positive multiplier.
- **Other creation paths.** The API, the SDKs, the MCP server and any import
  tooling reach the same field. If the backend does not reject it, fixing one
  UI fixes one path.
- **Scope.** This is a billing-correctness question, not a frontend refactor.

## Suggested actions

1. **Backend:** reject a non-positive multiplier on `POST /features` and
   `POST /meters`. Server-side is the only place that covers every client.
2. **Data:** identify and report affected meters.
3. **Frontend V1:** fix the comparison: one line: independently of V2.

## Already fixed in V2

`packages/domain/src/feature.ts` validates the multiplier as a decimal string,
rejecting `0`, negatives and non-numerics. Covered by `feature.test.ts`
("rejects a zero multiplier, which V1 lets through") and by the
`ZeroMultiplierRejected` story. That protects the new console only.

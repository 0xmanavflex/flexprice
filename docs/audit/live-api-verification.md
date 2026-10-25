# Live API verification of the `@fp/query` mappers

Every `@fp/query` module was run against the **live** backend
(`https://api.cloud.flexprice.io/v1`, tenant `tenant_01KVSNYVMBNGWZZQGBQG0G7M2V`,
environment `env_01KVSNYVPMAP6JJGDF177V2DE6`: "Sandbox"), using each module's
own `to<X>Filter` to build the request and its own `to<X>` to map the response.
Reads only; nothing in the tenant was created, changed or deleted.

The driver hooked `beforeRequest` and recorded the **actual outgoing body**, not
the object the filter builder returned. That distinction is what this audit
turned on: the SDK parses every request through a generated zod schema that
**silently strips keys the model does not declare**, so a filter can look
correct in a unit test, serialise to something quite different, and fail
invisibly. The driver has been deleted; its findings are below.

## Why the fixture corpus could not have caught any of this

`apps/console/src/mocks/handlers.ts` accepted **both** `name_contains` and
`nameContains`, and **both** `plan_id` and `planId`. Every bug in the "Fixed"
rows below was a request the mock understood and the real API did not. The
handler has been taught the filter DSL so the mock is now as strict as the API
rather than laxer than it.

## Module table

| Module                             | SDK operation                                             | Live status                                                         |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| `plans`                            | `plans.queryPlan` → `POST /plans/search`                  | **Fixed**: search was dropped on the wire                          |
| `plans` (detail)                   | `plans.getPlan` → `GET /plans/{id}`                       | OK                                                                  |
| `plans` (subscriber rail)          | `subscriptions.querySubscription`                         | **Fixed**: `plan_id` stripped, rail counted the whole tenant       |
| `features`                         | `features.queryFeature` → `POST /features/search`         | OK: `name_contains` and `expand=meters` both honoured              |
| `addons`                           | `addons.queryAddon` → `POST /addons/search`               | **Fixed**: search was dropped on the wire                          |
| `coupons`                          | `coupons.queryCoupon` → `POST /coupons/search`            | **Fixed**: search was dropped on the wire                          |
| `coupons` (associations)           | `couponAssociations.listCouponAssociations`               | Unverified: tenant has no associations                             |
| `customers`                        | `customers.queryCustomer` → `POST /customers/search`      | OK                                                                  |
| `subscriptions`                    | `subscriptions.querySubscription`                         | **Fixed**: no `expand`, so every Customer cell rendered a raw ULID |
| `invoices`                         | `invoices.queryInvoice` → `POST /invoices/search`         | OK: verified against one real invoice                              |
| `payments`                         | `payments.listPayments` → `GET /payments`                 | Unverified: tenant has no payments                                 |
| `taxRates`                         | `taxRates.getTaxRates` → `GET /taxes/rates`               | Unverified: tenant has no tax rates                                |
| `priceUnits`                       | `priceUnits.queryPriceUnit` → `POST /prices/units/search` | **Fixed** (by inference): unverified mapper, tenant has none       |
| `groups`                           | `groups.queryGroup` → `POST /groups/search`               | Unverified: tenant has no groups                                   |
| `costSheets`                       | `costs.queryCostsheet` → `POST /costs/search`             | Unverified: tenant has no cost sheets                              |
| `prices`                           | `prices.queryPrice` → `POST /prices/search`               | OK: verified against 2 real prices                                 |
| `entitlements`                     | `entitlements.queryEntitlement`                           | Unverified: the tenant's plan grants none                          |
| `creditGrants`                     | `creditGrants.getPlanCreditGrants`                        | Unverified: the tenant's plan has none                             |
| `counts` (`useNavCounts`)          | five `limit:1` search calls                               | OK                                                                  |
| `catalogStats` (`useCatalogStats`) | `limit:1` × total/published/archived                      | OK                                                                  |

"Unverified" means the request shape was confirmed live (the endpoint returned
`200` with a well-formed envelope) but **the mapper never ran on a real record**
because the tenant holds no rows. Those mappers were checked statically against
the SDK's declared response models: every field each `…Wire` reads exists on
the corresponding `…Response`: which is evidence of consistency, not proof of
correctness. They should not be treated as verified.

---

## Problem 1: the search box did nothing on four lists

`toPlanFilter`, `toAddonFilter`, `toCouponFilter` and `toPriceUnitFilter` all
sent `nameContains`. None of the four SDK filter models declares that field
(only `FeatureFilter` does), so zod stripped it before the request was sent.

Evidence, plans, before the fix: built vs. actually sent:

```
BUILT : {limit:25, offset:0, sort:[…], expand:"prices", nameContains:"a"}
SENT  : {"expand":"prices","limit":25,"offset":0,"sort":[{"direction":"asc","field":"name"}]}
```

The search term is simply gone. Bypassing the SDK does not help either: the
backend ignores the field on these routes as well:

```
POST /plans/search  {"limit":25,"name_contains":"zzzznomatch"}   -> 1 item (the row that should not match)
POST /features/search {"limit":25,"name_contains":"zzzznomatch"} -> 0 items (correct)
```

So features genuinely supports `name_contains`; plans, add-ons and coupons do
not. What they _do_ support is the generic filter DSL, which the SDK models as
`filters: FilterCondition[]`:

```
POST /plans/search {"filters":[{"field":"name","operator":"contains",
                                "data_type":"string","value":{"string":"Tes"}}]}  -> 1
                   … same with "zzzznomatch"                                      -> 0
```

**Fix.** New `packages/query/src/search.ts` exports `nameContainsFilter(term)`,
which builds that condition; the four filter builders now spread
`{ filters: nameContainsFilter(query.search) }` instead of `nameContains`.
Confirmed live after the change: searching `"a"` against a catalogue whose only
plan/add-on/coupon is named `"Test"` now returns `total: 0`, where before it
returned `total: 1`.

This is deliberately a server-side fix rather than filtering the fetched page in
the browser. Page-local search would look at 25 rows out of however many exist
and report a total that disagrees with what is on screen.

`priceUnits` is fixed the same way on the same reasoning, but the tenant has no
price units, so the DSL was only confirmed to be _accepted_ there (`200`, no
error), not to _match_. Flagging that honestly: it is inference from the other
three, not a verified result.

## Problem 2: every subscription's Customer column showed a raw ULID

`toSubscriptionFilter` sent no `expand`. The live search embeds `plan` by
default but **not** `customer`, so `toSubscription` fell through its whole
fallback chain: `customer?.name || customer?.email || customerId`: and landed
on the id:

```
expand=none              -> hasCustomer:false  customerName:"cust_01M3HQZ3W2H2G0AX8XTS2KA2WC"
expand="customer"        -> hasCustomer:true   customerName:"Test"
expand="customer,plan"   -> hasCustomer:true   customerName:"Test"   (plan still present)
```

The fallback is doing exactly what it was written to do; it was being handed
nothing to work with. This is the same class of bug as the `expand: 'meters'`
note in `features.ts`, and it would have shipped as "why is the customer column
full of ULIDs".

Note the value is **singular**. `expand: 'customers'` is accepted and silently
does nothing: it returns `200` with no `customer` on the row, which is the most
expensive possible way to be wrong:

```
expand="customers" -> hasCustomer:false
```

**Fix.** `toSubscriptionFilter` now sends `expand: 'customer,plan'`. `plan` is
named explicitly rather than relied on as an undocumented default.

## Problem 3: the plan subscriber rail counted the whole tenant

`usePlanSubscriptions` sent `{ plan_id: planId, limit: 100 }` in snake_case.
`SubscriptionFilter` declares `planId` (and remaps it to `plan_id` on the wire
itself), so the literal `plan_id` was stripped and the request left as an
unscoped list:

```
sent {plan_id: …, limit:100}  ->  POST /subscriptions/search {"limit":100}
sent {planId:  …, limit:100}  ->  POST /subscriptions/search {"limit":100,"plan_id":"plan_01M3…"}
```

The rail was therefore counting every subscription in the tenant and labelling
it as the plan's. With one plan and one subscription in this tenant the two
numbers coincide, which is precisely why it needed the wire body rather than the
result to detect.

**Fix.** `usePlanSubscriptions` now passes `planId`.

---

## Verified correct: worth recording, because each was a plausible failure

**`pagination.total` is universal.** Every list endpoint returns
`{items, pagination:{total, limit, offset}}`. None returns a top-level `total`
the way `/environments` does, so `response.pagination?.total ?? 0` is right
everywhere, and `useNavCounts` / `useCatalogStats` are sound. Counts read live:
plans 1, features 3, add-ons 1, coupons 1, price units 0, customers 1,
subscriptions 1, invoices 0.

One oddity, harmless: `pagination.offset` echoes back the _next_ offset
(request `offset:0, limit:25` → response `offset:25`). Nothing reads it.

**The `status` count split works.** `{limit:1, status:'published'|'archived'}` is
honoured on all five catalogue entities, so the published/archived strip is
reporting the server's numbers.

**Sort works, and fails loudly.** `sort: [{field, direction}]` is the correct
shape and field names are snake_case. Every field any module can send was
checked and accepted: `name`, `created_at`, `updated_at` (plans, add-ons,
coupons, features, groups, price units), `code` (price units), `start_date`
(subscriptions), `issue_date`, `due_date`, `amount_due`, `invoice_status`
(invoices). An unknown field returns an explicit error rather than ignoring the
sort: `"Unknown field name 'bogus_field' in feature query"`: so a typo here
would be visible, not silent. Ordering was confirmed to actually change against
the three features in the tenant.

**`expand` is honoured where it is relied on.** `expand:'prices'` on plans
returns full price objects (so the Charges column reads 2, not 0, and the
headline resolves); `expand:'meters'` on features returns the embedded meter
(event name and aggregation both present); `expand:'meters'` on prices returns
the meter name.

**`costSheets`' odd `queryFilter` nesting is correct as written.** It is the one
filter that nests paging, and the SDK emits it camelCase while every other field
on every other endpoint is snake_case. That looked like an SDK bug, so it was
probed directly: the backend accepts `queryFilter` and **ignores**
`query_filter`:

```
{"queryFilter":{"limit":7,"offset":3}}  -> pagination {limit:7,  offset:3}
{"query_filter":{"limit":7,"offset":3}} -> pagination {limit:50, offset:0}   (defaults)
```

So the mapper and the SDK are both right. Leave it alone.

**The invoice mapper is verified**: see the next section for why that was not
obvious.

## The tenant is not as empty as it looks

Invoices were reported as empty, and an unfiltered `POST /invoices/search` does
return `total: 0`. But the tenant holds one invoice, which the default search
hides:

```
invoice_status=["SKIPPED"] -> total 1
```

Filtering by it exercised `toInvoice` on a real record, which maps correctly:
`invoiceNumber` is `""` so `number` falls back to the id (as designed),
`customer` is embedded by default on this endpoint (no `expand` needed),
`amountRemaining` is `"0"` so `deriveInvoiceStatus` resolves `SKIPPED` +
`PENDING` + no balance to `skipped`, and the three money fields join their
`"usd"` to `{amount, currency:"USD"}`.

`invoices` therefore moves from "unverified" to **OK**.

## Possible backend issues, not frontend ones

1. **`invoice_status` is not validated.** `{"invoice_status":["BOGUS"]}` returns
   `200` with `total: 0` rather than an error, unlike `sort`, which rejects an
   unknown field explicitly. A typo in a status filter would read as "no
   invoices match" instead of "that is not a status". Nothing in the console
   sends an invalid value, so this is a report, not a bug we have.

2. **An unfiltered invoice search hides `SKIPPED` invoices.** `total: 0` with no
   status filter, `total: 1` with `invoice_status:["SKIPPED"]`. If that default
   exclusion is intentional it is undocumented; if it is not, the invoice list
   under-reports. Either way the console's invoice list will not show this
   tenant's only invoice, and the record count will say 0.

3. **`name_contains` is accepted and ignored** on `/plans/search`,
   `/addons/search` and `/coupons/search`, rather than rejected. It is a
   documented field on the sibling `/features/search`, so silently discarding it
   on the others is the kind of asymmetry that produces exactly the bug in
   Problem 1.

4. **`expand` values are accepted and ignored when unrecognised.**
   `expand: 'customers'` on `/subscriptions/search` returns `200` and simply
   omits the expansion. An unknown expand token should be an error.

## Fixture corpus

No fixture was found to contradict the live API in a way that required
regenerating it, and no capture was run: `packages/query/src/__fixtures__/generated/`
is untouched. `coupons.json` is an authored corpus and was left alone as
instructed.

One caveat for whoever re-captures next: the captured corpus embedded a
`customer` on subscription rows, which the live API does **not** return without
`expand: 'customer'`. That is why Problem 2 survived the fixtures. A re-capture
run after this change will now request the expand and the corpus will match; a
re-capture run against the _old_ filter would bake the bug back in.

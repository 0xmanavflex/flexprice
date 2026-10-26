# Migration

The architecture-proving phase is over. It is **frozen**: no new package
layers, no new abstraction categories, no second component taxonomy, no other
state-management solution, no speculative agent infrastructure, and no further
proofs for their own sake. Unless a real migration exposes a problem, the
architecture is good enough.

## The rule

> **New code follows V2. Existing V1 code migrates when touched, or when there
> is a clear product or maintenance benefit.**

V2 is not a mandate to rewrite 141,886 lines. The decision per surface is:

```
V1 surface touched
      ↓
Can it be migrated cleanly?
      ↓
Yes  -> migrate using V2
No   -> isolate, and write down why
```

## Measure every migration

"V2 is cleaner" convinces nobody. Each migrated surface records a before/after:

| Before | After |
|---|---|
| Hand-written API classes | Generated SDK calls |
| Hand-written DTOs | SDK types + domain mapping |
| `useState` | RHF + domain model |
| Modal form | Page + stepper |
| Component fetching | Page + query |
| API-shaped props | Domain-shaped props |
| Hand-rolled table | ReUI composition |
| Untested states | Story + browser test |
| Implicit rules | Domain tests |
| Special-case adapter code | 0 shims |

**The Price Override slice is the template**: 807 lines and 12 `useState` hooks
in a dialog became a presentational form with zero `useState`, a domain
discriminated union, and 12 browser-tested interactions: which also surfaced
two silent revenue bugs (overlapping tier bands, and a closed final band).

## Phase 0 is a dependency, not frontend work

> **Backend dependency: OpenAPI annotation completeness**
> **Owner:** Backend.
> **Impact:** real data for the subscription workflow and the Customer Portal.
> **UI impact:** none for architectural development; blocks production
> integration of the affected surfaces.

**Do not add `sdk-adapter` shims because the backend is temporarily
incomplete.** Three slices have been built with zero shims, and that is
evidence the generated boundary is working. A shim added for convenience spends
that evidence.

### The gap is narrower than 109 handlers suggests

Per-handler analysis shows the undocumented handler is almost always the plain
`GET` list: and every one of those entities has a **documented
`POST /<entity>/search`** that is strictly more capable (filters, sort,
pagination):

| Handler file | Documented | Missing |
|---|---|---|
| `payment` | 6/6 |: |
| `customer` | 10/11 | `ListCustomers` |
| `addon`, `coupon` | 8/9 | `ListAddons`, `ListCoupons` |
| `price` | 7/8 | `ListPrices` |
| `entitlement` | 6/7 | `ListEntitlements` |
| `creditnote` | 4/5 | `ListCreditNotes` |
| `plan` | 9/11 | `ListPlans`, `SyncPlanPricesV2` |
| `feature` | 5/7 | `ListFeatures`, `GetFeature` |

So the catalog and customer surfaces are migratable **today, with no shims**:
the invoice grid already uses `POST /invoices/search` for exactly this reason.

The genuinely blocked surfaces are unchanged and are what Phase 0 should
prioritise: `customer_portal` 0/25, `webhook` 0/12, `meter` 0/6,
`connection` 0/6, `environment` 1/5, `auth` 0/2, `workflow` 1/5.

## Open product decision: derived invoice filters

`overdue` is derived: finalized, unpaid, past due: and is not an API value.
The current behaviour is deliberate and should not be changed without a
decision:

- `deriveInvoiceStatus()` computes it in the domain
- `isServerFilterable()` states which statuses the server understands
- `toInvoiceFilter()` drops the derived ones rather than approximating them

**The decision: should derived states become first-class backend filters?**

- **Yes** → the API exposes `OVERDUE` semantics, and the frontend deletes a rule.
- **No** → the frontend defines an explicit client-side filtering strategy, with
  its pagination and performance implications understood and written down.

What must **not** happen is the UI quietly translating `overdue` into
`invoiceStatus = FINALIZED AND paymentStatus != SUCCEEDED`. That is the UI
inventing business semantics, and it will disagree with the backend eventually.

## Recommended first migration: Product Catalogue → Features

Chosen on measurements, not preference.

| | |
|---|---|
| Size | 2,017 LOC across **three files** |
| `AddFeature.tsx` | **1,106 lines**: the second-largest file in the V1 repo |
| `useState` | 13 |
| Table | `FlexpriceTable`, hand-rolled |
| Tests/stories | **1**, for the whole surface |
| APIs touched | 3: `FeatureApi`, `EntitlementApi`, `PriceApi` |
| SDK coverage | `entitlement` 6/7, `price` 7/8, `feature` 5/7 |
| Shims required | **0**: `FeatureFilter` carries `featureIds`, `lookupKey`, `nameContains`, `limit`/`offset`, `sort`, so search covers both the list and by-id lookup |

Why this one:

1. **It is exactly the three proven patterns**, and nothing else: a list
   (`Features.tsx`), a large creation form (`AddFeature.tsx`), and a detail page
   (`FeatureDetails.tsx`). It re-runs all three proofs against code somebody
   actually uses.
2. **The form is a page already**, so the before/after is a like-for-like
   comparison of form architecture rather than a page-versus-modal argument.
3. **It touches three APIs, all well covered**, and notably *not* `MeterApi`
   (0/6 documented): verified, not assumed.
4. **Features are foundational.** Every plan and entitlement references one, so
   the domain model built here is reused by the next several migrations.
5. **It is finishable in one cycle**, which matters more than breadth for the
   first migration under a new rule.

Runner-up: **Addons** (834 LOC, 8/9 documented, self-contained) if a smaller
first step is wanted. **Plans** is deliberately *not* first: it depends on
`WorkflowApi`, which is 1/5 documented.

Explicitly not first: anything under `customer_portal`, and
`CreateCustomerSubscriptionPage` (966 lines), which pulls in subscriptions and
addons and would turn the first migration into a second architecture project.

---

# Migration 1: Product Catalogue → Features

Status: **done**. Routes `/features` and `/features/new`.

## Before / after

| | V1 | V2 |
|---|---:|---:|
| Source LOC | 2,017 | **983** |
| `useState` | 13 | **0** |
| Largest file | `AddFeature.tsx` **1,106** | `FeatureForm.tsx` **275** |
| Tests / stories | **0** | **5 files, 60 tests** |
| API classes | 3 hand-written | 0: generated SDK |
| Hand-rolled table | `FlexpriceTable` | ReUI `data-grid` |
| Validation | 2 callbacks + 4 state slices | 1 domain schema |
| Component fetching | yes | no: page + query |
| Deep-linkable list | no | yes: URL search params |
| `sdk-adapter` shims |: | **0** |

983 LOC includes 81 lines of fixtures that V1 has no equivalent of. The form
alone went from 1,106 lines to 275.

## Three defects the migration exposed

1. **A zero multiplier passes validation in V1.** `AddFeature.tsx` writes
   `meterData.aggregation.multiplier <= 0`, but `multiplier` is a *string* on
   the wire, and `'0' <= 0` is `false` in JavaScript. A `SUM_WITH_MULTIPLIER`
   feature created with a zero multiplier is accepted and then bills nothing.
   The domain schema rejects it, and a story covers it.

2. **The aggregation rule could not be checked outside the form.** V1 decides
   whether to require `field` or `expression` by reading a `showCustomExpression`
   boolean out of component state: so the rule only exists while the form is
   mounted. In the domain it is one rule satisfied by either, and it holds
   wherever it is applied.

3. **A meter survives a type switch.** V1 keeps meter data in a separate state
   slice, so switching a metered feature to Boolean leaves the meter in scope.
   The discriminated union makes that unrepresentable, and a story asserts it.

## What it confirmed about the contract

`GetFeature` and `ListFeatures` carry no swagger annotation, so the SDK has no
`getFeature`. Both are served by the documented `POST /features/search`, whose
filter carries `featureIds`, `lookupKey`, `nameContains`, `limit`/`offset` and
`sort`. **No shim was needed.**

`CreateFeatureRequest` carries an optional `meter`, so a metered feature and its
meter are a single documented call. Nothing touches `MeterApi` (0 of 6
annotated), which would otherwise have blocked this surface entirely.

## Known gap, stated rather than hidden

`FeatureFilter` has no type filter, so filtering by feature type is applied
client-side in `fetchFeatures`: which narrows *the current page*, not the whole
set. This is the same class of problem as `overdue` on invoices, and gets the
same treatment: named, not approximated. If type filtering matters, the
backend adds it to `FeatureFilter`.

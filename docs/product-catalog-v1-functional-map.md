# V1 product catalogue: the complete functional map

Every field, every enum, every constraint the current product catalogue exposes.
Read from `flexprice-front` source, not from screenshots. This exists so the V2
redesign can be checked against it field by field: **nothing here may disappear.**

The rule this map serves:

> Keep the power and the terminology of V1. Change the information
> architecture and the interaction. Make the complexity *progressive*, never
> absent.

So `aggregation` stays `aggregation`. `invoice_cadence` stays `invoice_cadence`.
What changes is where a field sits, what it sits next to, and whether the screen
shows you the consequence of setting it.

---

## The object graph

```
Feature ──< Entitlement >── Plan ──< Charge (Price)
   │                          │
   └── Meter (metered only)   └──< Credit Grant
                              │
Addon ──< Charge              └── Coupon (applied at subscription/invoice)
      └─< Entitlement
      └─< Credit Grant

Cost Sheet ──< Charge          Group ──> Features | Prices
Price Unit ──> used by Charge
```

A **Plan** is the sellable thing. It carries **Charges** (what is billed),
**Entitlements** (what is allowed), and **Credit Grants** (what is given). An
**Addon** is the same structure, not sellable alone. A **Cost Sheet** is the same
charge structure pointed at cost rather than price.

---

## 1. Feature

`src/models/Feature.ts`, `src/pages/product-catalog/features/AddFeature.tsx`

### 1.1 Feature fields

| Field | Type | Notes |
|---|---|---|
| `name` | string, required | Typing it derives `lookup_key` and the meter's `name` |
| `lookup_key` | string | Auto `feat-<slug>`, editable |
| `type` | `METERED` \| `BOOLEAN` \| `STATIC` \| `CONFIG` | **Create-only. Not editable afterwards.** |
| `description` | string | |
| `group_id` | Group id | Group must have `entity_type = feature` |
| `unit_singular` / `unit_plural` | string | Metered only. Typing singular auto-fills plural + "s" |
| `reporting_unit` | `{ unit_singular, unit_plural, conversion_rate }` | Metered only. A *display* unit: e.g. store tokens, show "1K tokens". `conversion_rate` defaults to `0.01` if blank/invalid |
| `metadata` | object | |

### 1.2 Feature type semantics

| Type | Means | Carries a meter | Entitlement value is |
|---|---|---|---|
| `METERED` | Usage measured from events | **Yes** | `usage_limit` (number or null = unlimited) |
| `BOOLEAN` | Access or no access | No | `is_enabled` |
| `STATIC` | A value configured per customer | No | `static_value` |
| `CONFIG` | A structured key/value block | No | `config_value` (JSON) |

### 1.3 Meter: metered features only, **create-only**

| Field | Values | Notes |
|---|---|---|
| `event_name` | string, required | What the customer's code sends |
| `filters` | `[{ key, values[] }]` | Only events matching every filter count |
| `aggregation.type` | `SUM` · `COUNT` · `COUNT_UNIQUE` · `SUM_WITH_MULTIPLIER` · `LATEST` · `MAX` · `WEIGHTED_SUM` · `AVG` | |
| `aggregation.field` | string | The event property. Required for everything except `COUNT` |
| `aggregation.expression` | CEL string | **XOR with `field`.** Only `SUM`, `AVG`, `MAX`, `LATEST` accept one. Switching to any other type silently clears it |
| `aggregation.multiplier` | number > 0 | Required for `SUM_WITH_MULTIPLIER` |
| `aggregation.group_by` | string | Splits usage by a property |
| `aggregation.bucket_size` | `MINUTE` `15MIN` `30MIN` `HOUR` `3HOUR` `6HOUR` `12HOUR` `DAY` `WEEK` `MONTH` | Windows usage before aggregating: e.g. per-hour `MAX` |
| `reset_usage` | `BILLING_PERIOD` \| `NEVER` | Whether the counter resets each period |

### 1.4 Alert settings

`critical` / `warning` / `info`, each `{ threshold, condition: above \| below }`,
plus `alert_enabled`.

### 1.5 What is editable after creation

Drawer, six fields: `name`, `description`, `group_id`, `unit_singular`,
`unit_plural`, `reporting_unit.*`.

**Not editable:** `type`, and the entire meter: event name, aggregation,
filters, bucket size, reset. This is correct behaviour (past invoices would stop
reconciling) but V1 never says so.

---

## 2. Plan

`src/models/Plan.ts`, `PlanDrawer.tsx`, `PlanDetailsPage.tsx`

| Field | Notes |
|---|---|
| `name`, `lookup_key`, `description`, `metadata` | The whole create drawer |

Everything that makes a plan a plan is attached afterwards:

- **Charges**: `EntityChargesPage`, a separate route, permissioned on `price`
- **Entitlements**: `AddEntitlementDrawer`, on a tab
- **Credit Grants**: `CreditGrantModal`, on another tab

Plan actions: edit · duplicate · archive · copy id · sync to integrations ·
view workflows.

---

## 3. Charge (Price): the largest surface in the catalogue

`src/models/Price.ts`, `UsagePricingForm.tsx` (816 lines),
`RecurringChargesForm.tsx` (660 lines)

### 3.1 Shared by every charge

| Field | Values |
|---|---|
| `type` | `FIXED` \| `USAGE` |
| `display_name` | string |
| `currency` | ISO code |
| `price_unit_type` | `FIAT` \| `CUSTOM` |
| `price_unit_config` | `{ price_unit, amount?, price_unit_tiers? }` when `CUSTOM` |
| `billing_period` | `DAILY` `WEEKLY` `MONTHLY` `QUARTERLY` `HALF_YEARLY` `ANNUAL` `ONETIME` |
| `billing_period_count` | number |
| `billing_cadence` | `RECURRING` \| `ONETIME` |
| `invoice_cadence` | `ADVANCE` \| `ARREAR` |
| `billing_model` | `FLAT_FEE` \| `PACKAGE` \| `TIERED` |
| `amount` / `display_amount` | decimal string |
| `lookup_key`, `description` | |
| `group_id` | Group with `entity_type = price` |
| `start_date` / `end_date` | |
| `min_quantity` | number |
| `metadata` | |
| `parent_price_id` | Set when a subscription overrides a plan price |

### 3.2 Billing models: five choices over three backend values

| UI label | Backend | Extra config |
|---|---|---|
| Flat Fee | `FLAT_FEE` | `amount` |
| Package | `PACKAGE` | `transform_quantity: { divide_by, round: up\|down }` |
| Volume Tiered | `TIERED` + `tier_mode: VOLUME` | `tiers[]`: all units priced at the tier reached |
| Slab Tiered | `TIERED` + `tier_mode: SLAB` | `tiers[]`: each tier priced separately |
| Percentage Fee | `FLAT_FEE` + decimal + a metadata marker | percentage of billable value |

`tiers[]` = `[{ up_to: number \| null, unit_amount, flat_amount }]`. Only the
**last** tier may have `up_to: null` (∞); the form normalises stray nulls on
earlier tiers defensively.

### 3.3 Usage charges only

| Field | Notes |
|---|---|
| `meter_id` | Chosen by picking a **metered Feature** |
| `filter_values` | `Record<string, string[]>`: charge only for a slice of the meter's events |
| `bucket_size` | Price-level windowing. **Rejected by the API if the meter already defines one**: the form disables the control and drops the stale value |

`ONETIME` is not offered as a usage billing period; older records fall back to
`MONTHLY`.

### 3.4 Fixed charges only

| Field | Notes |
|---|---|
| `trial_period_days` | Recurring only; cleared when cadence becomes `ONETIME` |
| Contract calculator | Enter a contract amount + term; it back-computes the per-period amount |

---

## 4. Entitlement

`src/models/Entitlement.ts`, `AddEntitlementDrawer.tsx`

| Field | Applies to | Notes |
|---|---|---|
| `feature_id` / `feature_type` | all | |
| `is_enabled` | `BOOLEAN` | |
| `usage_limit` | `METERED` | `null` = unlimited |
| `is_soft_limit` | `METERED` | Soft = allow overage and bill it. Hard = block |
| `usage_reset_period` | `METERED` | `DAILY` `WEEKLY` `MONTHLY` `QUARTERLY` `HALF_YEARLY` `ANNUAL` `NEVER` |
| `static_value` | `STATIC` | |
| `config_value` | `CONFIG` | JSON object |
| `display_order` | all | Ordering in a pricing table |
| `start_date` / `end_date` | all | |
| `entity_type` | | `PLAN` \| `SUBSCRIPTION` \| `ADDON` |
| `parent_entitlement_id` | | Set when a subscription overrides a plan entitlement |

A **display calculator** converts a value in the feature's *reporting unit* into
the stored unit (e.g. "5 M tokens" → `5000000`).

---

## 5. Credit Grant

`src/models/CreditGrant.ts`, `CreditGrantModal.tsx`

| Field | Values |
|---|---|
| `name` | string |
| `credits` | number |
| `cadence` | `ONETIME` \| `RECURRING` |
| `period` | `DAILY` `WEEKLY` `MONTHLY` `QUARTERLY` `HALF_YEARLY` `ANNUAL`: recurring only |
| `period_count` | number |
| `expiration_type` | `NEVER` \| `DURATION` \| `BILLING_CYCLE` |
| `expiration_duration` + `expiration_duration_unit` | number + `DAY` `WEEK` `MONTH` `YEAR` |
| `priority` | number: which grant is consumed first |
| `scope` | `PLAN` \| `SUBSCRIPTION` \| `ADDON` |
| `conversion_rate` / `topup_conversion_rate` | credit ↔ money |
| `credit_grant_anchor`, `start_date`, `end_date` | |

---

## 6. Addon · Cost Sheet · Coupon · Price Unit · Group

**Addon**: `name`, `description`, `lookup_key`, `metadata` + Charges +
Entitlements + Credit Grants. Structurally a Plan that cannot be sold alone;
shares `EntityChargesPage` outright.

**Cost Sheet**: `name`, `description`, `lookup_key` + Charges. The same charge
machinery pointed at **cost**, so margin can be computed.

**Coupon**: `type: fixed \| percentage`, `amount_off` \| `percentage_off`,
`currency`, `cadence: once \| repeated \| forever`, `duration_in_periods`,
`coupon_code`, `redeem_after` / `redeem_before`, `max_redemptions`,
`total_redemptions`, `rules`.

**Price Unit**: `name`, `code` (3 chars), `symbol`, `base_currency`,
`conversion_rate`.

**Group**: `name`, `lookup_key`, `entity_type: price \| feature`, `entity_ids[]`.

---

## 7. Field count, and what that implies

| Object | Fields a user can set |
|---|---|
| Feature (+ meter) | ~20 |
| Charge | ~22 |
| Entitlement | ~11 |
| Credit Grant | ~13 |
| Plan itself | 4 |

**A fully configured plan with three charges and four entitlements is well over
a hundred decisions.** That is not accidental complexity to be designed away:
it is the product. The design problem is that V1 presents all of it at one
altitude, in five containers, with no indication of which decisions are load
bearing.

---

## 8. What V2 changes, and what it must not

### Must not change

- Terminology. Feature · Plan · Charge · Entitlement · Credit Grant ·
  Metered · Boolean · Static · Config · Fixed · Usage-Based · Aggregation ·
  Billing Period · Invoice Cadence · Volume / Slab Tiered · Bucket Size ·
  Soft Limit · Usage Reset Period · Price Unit · Group.
- Any field in this document. Every one stays reachable.
- The object model. No new concepts, no merged concepts.

### Changes

1. **Containers.** A Plan is configured on one screen: Details, Charges,
   Entitlements, Credit Grants: instead of a drawer, a separate route, a
   drawer on a tab, and a modal on another tab.

2. **Altitude, not omission.** Every charge field stays on the charge editor.
   The ~6 that most charges set sit at the top; the other ~16 sit under
   **Advanced** *inside the same panel*. Advanced is open by default once any
   field in it is non-default, and its header counts what is set: so nothing
   is ever hidden without saying so.

3. **Consequence beside control.** `aggregation.type` keeps its name and its
   eight values, and gains a worked result against sample events. `VOLUME` vs
   `SLAB` keeps both names and gains the two totals they produce for the same
   quantity. The technical control is never replaced by the explanation.

4. **Irreversibility, stated.** Feature `type` and the whole meter are
   create-only. The form says so at the point of decision.

5. **One validity check.** V1 has three: a Zod schema, a hand-written meter
   validator, and a separately derived disabled state. V2 has the domain schema
   and nothing else.

6. **Plans read as pricing.** The Plans surface leads with a pricing
   representation: plans side by side with their charges and entitlements, the
   way a customer would see them: because that is the artefact being designed.
   The full editor is one click behind it, not replaced by it.

7. **Features are first class.** Feature creation stays a full page with the
   complete meter configuration, not a step inside plan creation.

# Product Catalog V2: build plan

Synthesized from a read of V1 (`flexprice-front`) across all catalogue entities.
V2 rebuilds each screen **faithful to V1's data and flow, better in form**: ReUI
components only (compose, never hand-roll), the console's domain→query→ui layers,
URL-as-query lists, and the design system already in place (brand hue, density,
count strips, pinned pagination).

The signature V2 improvement: **a live preview beside the editor** wherever there
is computed output: pricing on the charges editor, the event shape on a meter,
the discount on a coupon.

---

## The one architectural fact that drives everything

A **plan is assembled across surfaces, not one form** (same in V1 for add-ons and
cost-sheets). The plan/add-on/cost-sheet **record itself only carries
name/lookup_key/description/metadata**. Its money lives in separate API calls:

- **Charges** = `POST /prices/bulk` (a bulk of `CreatePriceRequest`), shared by
  plan/add-on/cost-sheet via an `entity_type` (PLAN | ADDON | COST_SHEET).
- **Entitlements** = `POST /entitlements/bulk` (plan/add-on).
- **Credit grants** = `POST /creditgrants`, one at a time (plan/add-on).

So V2 builds the **charge editor once** (parameterized by entity_type) and reuses
it. The detail page is the hub where charges/entitlements/grants are added.

---

## Shared foundation (build first: everything depends on it)

**Domain (`packages/domain/src/`)**
- `price.ts`: `Price`/`Charge` read model + `createChargeSchema`. Enums:
  `PriceType {FIXED, USAGE}`, `BillingModel {FLAT_FEE, PACKAGE, TIERED}` (+ UI
  `SLAB_TIERED`→TIERED/SLAB, `PERCENTAGE`→FLAT_FEE marker), `TierMode {VOLUME,
  SLAB}`, `BillingPeriod {DAILY,WEEKLY,MONTHLY,ANNUAL,QUARTERLY,HALF_YEARLY,
  ONETIME}`, `InvoiceCadence {ADVANCE,ARREAR}`. A `Tier {up_to:number|null,
  unit_amount, flat_amount?}` (`from` is UI-derived). Money via existing `money`.
- `entitlement.ts`: read model + `createEntitlementSchema`; per feature type
  (metered: usage_limit|unlimited + usage_reset_period + is_soft_limit; static:
  static_value; boolean: is_enabled; config: config_value JSON).
- `creditGrant.ts`: read model + schema (cadence ONETIME|RECURRING, credits,
  conversion_rate, topup_conversion_rate, period+period_count when recurring,
  expiration_type NEVER|BILLING_CYCLE|DURATION, priority).

**Query (`packages/query/src/`)**
- `prices.ts`: `usePrices(entityType, entityId)` (POST `/prices/search`),
  `useCreateBulkPrices()` (POST `/prices/bulk`), `useUpdatePrice`,
  `useTerminatePrice` (DELETE with optional end_date). `toCharge`/`toChargeRequest`.
- `entitlements.ts`: `useEntitlements(entityType,id)` (POST `/entitlements/search`),
  `useCreateBulkEntitlements`, `useDeleteEntitlement`.
- `creditGrants.ts`: `useCreditGrants(scope,id)`, `useCreateCreditGrant`,
  `useDeleteCreditGrant`.
- Extend `keys.ts` (prices/entitlements/creditGrants) and mocks (`handlers.ts`)
  with `/prices/bulk`, `/prices/search`, `/entitlements/*`, `/creditgrants*`.

**ReUI components to install** (free unless noted): `number-field`,
`date-selector`. Charge editor grid → compose from the vendored `data-grid` +
`number-field` (or install `data-grid-editing-3` [pro] if a full inline grid is
wanted). Tabs/Sheet/Dialog/Select already vendored.

**UI (`packages/ui/src/flexprice/`)**: the shared, reusable pieces:
- `ChargeEditor`: the two-pane charges surface: left = a list of charge cards
  (Fixed via `RecurringChargeForm`, Usage via `UsageChargeForm`), each with
  billing model select → conditional inputs, `TierTable` for tiered/volume; right
  = **live `PlanPreviewCard` + example-bill estimate**. Emits `Charge[]`.
- `PlanPreviewCard`: reuse the pricing card already in `PlanGrid`'s cards view,
  driven from the draft charges (the live preview).
- `EntitlementDrawer`, `CreditGrantDialog`: the add surfaces.

---

## Per-entity screens (build after foundation; parallelizable)

Every list page already exists. What's new: **detail pages, editors, and the
two-pane charges builder.** V1 fields/APIs are in the agent specs; summary here.

### Plans  (centerpiece)
- **Detail** `/plans/:id`: tabbed hub: **Overview** (charges table + Add→charges
  editor), **Entitlements** (table + Add drawer), **Credit Grants** (table + Add
  dialog), **Information** (details + metadata + edit). Header: Edit (drawer),
  Duplicate, Archive, Sync usage charges.
- **Charges editor** `/plans/:id/charges`: the shared two-pane `ChargeEditor`
  with live preview. **This is the signature two-pane + live-preview screen.**
- Details create/edit stays the drawer (already built) → on create, navigate to
  the new detail page.
- List extras from V1: Duplicate (`/plans/:id/clone`), status filter.

### Add-ons
- **Detail** `/addons/:id`: one **stacked** page: Details · Charges (shared
  editor) · Entitlements · Credit Grants · Metadata. Edit drawer already built.

### Cost Sheets
- **Detail** `/cost-sheets/:id`: stacked: Details · Charges (shared editor,
  entity_type COST_SHEET, rows read-only) · Metadata. Drawer: name/lookup/desc.

### Features
- **Detail** `/features/:id`: read-only: **Event Details** (metered: event name,
  filters, aggregation, + a live **event JSON / cURL** preview), **Entitlements**
  (plans/add-ons using it), **Charges** (prices on the meter). Header: Edit
  (drawer), Archive, Alert Settings (dialog). *Improve V1: keep the live event
  preview.*
- **Create** `/features/new`: already exists; make it the full-page two-pane with
  the live event preview (V1 has this).
- **Edit** drawer already exists. **Alert Settings** dialog (thresholds).

### Coupons
- **Detail** `/coupons/:id`: details card (exists in V1). *Improve V1: add a
  "where used" associations section, and a live discount preview in the editor.*
- Create/edit drawer already exists.

### Price Units
- **No detail page** (V1 parity). List + drawer only (name, code[3], symbol,
  base_currency, conversion_rate; update = name+metadata only). List + drawer to build.

### Groups
- **Profile** `/groups/:id`: tabs: **Overview** (members: prices or features by
  `group_id`) · **Information**. Drawer (name, lookup, entity_type price|feature).
  *Improve V1: add members management + edit/archive on the profile.*

---

## Conventions (from V1, keep)
- Lookup key auto-slugged from name on create, locked on edit.
- "Archive" = `DELETE /:id` (soft); no hard delete; archived can't re-archive.
- Charges permissioned by `price`, not the parent entity.
- Update payloads are narrow (coupon/price-unit/group = name/metadata only):
  the backend enforces immutability; the editor should reflect it (read-only fields).
- Empty states: icon + one line + primary CTA (better than V1's bare states).

## Build order / parallelization
1. **Foundation** (domain price/entitlement/creditGrant + query + ReUI installs +
   `ChargeEditor`/`PlanPreviewCard`): one coordinated commit; unblocks the rest.
2. Then parallel per-entity waves (each agent owns its page files; shared barrels/
   router wired by the coordinator): **(a)** Plan detail + charges builder,
   **(b)** Feature detail + create/alerts, **(c)** Add-on + Cost-Sheet detail,
   **(d)** Price Units + Groups + Coupon detail.
3. Edit model for plans: **mutate in place** (default); revisit versioning later.

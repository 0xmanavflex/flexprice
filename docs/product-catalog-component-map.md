# Product Catalog: page-by-page component map (ReUI)

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

A build list for the V2 product catalog: every catalog page, broken down into the
small reusable pieces it is made of, each mapped to a **ReUI** item with a link and
an install status. Checked field-by-field against
[`product-catalog-v1-functional-map.md`](./product-catalog-v1-functional-map.md) so
nothing from V1 disappears. Consolidates and extends
[`reui-suggestions.md`](./reui-suggestions.md) and
[`reui-components.md`](./reui-components.md).

---

## How to read this

- **Scope:** product catalog only: Features, Plans (+ Charges, Entitlements, Credit
  Grants), Addons, Coupons, Cost Sheets, Price Units, Groups. Billing / Revenue /
  Developers live in [`reui-suggestions.md`](./reui-suggestions.md).
- **"Matches flexprice-front":** the V2 console is a clean-sheet design on
  **`base-nova` (Base UI) + Tailwind v4**, not a restyle of V1 (Radix + Tailwind v3).
  So parity means **same capability + same V1 terminology**, themed by the console's
  own tokens: *not* copying V1's hex values. The **flexprice-front parity** column
  names the V1 component each piece replaces so the mapping is checkable.
- **Surface lock: `card`.** Two best-fit blocks are `frame`: flagged 🔒; convert or
  accept a second surface (see [Open decisions](#open-decisions)).
- **"data-grid-6"** = the in-repo block **`data-grid-base-6`**
  (`packages/ui/src/components/blocks/data-grid-base-6/`), the `base-nova` build of
  the c-data-grid-6 pattern (auto-width table + pagination). It is vendored but not
  yet consumed by a page. All list screens use it.
- **Legend:** ✅ vendored in repo · ➕ `pnpm ui:add <name>` · 🧩 already built in
  `@fp/ui` · 💲 Pro block · 🔒 `frame` surface.
- **Build order** (`docs/design/README.md`): **Features → Plans → Add-ons → Coupons**;
  Price Units, Groups, Cost Sheets are independent. Complex flows are **pages + a
  Stepper with step state in the URL**, never modals.

---

## 0. Global building blocks: the "small small" pieces every catalog page reuses

Build these once; every entity below composes from them.

### 0.1 Page skeleton (`docs/design/README.md` §4.1.3)

| Piece | ReUI / source | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Header (title, breadcrumb, primary CTA) | `PageHeader` | 🧩 `@fp/ui/compositions` | `atoms/Page` + `SectionHeader` |: |
| Toolbar row (filter + sort + view toggle) | `PageToolbar` | 🧩 `@fp/ui` | `molecules/QueryBuilder` |: |
| Body / content region | `PageBody` | 🧩 `@fp/ui` | `organisms/QueryableDataArea` |: |
| Footer (pagination) | `PageFooter` / `GridFooter` | 🧩 `@fp/ui` | `atoms/ShortPaginationControls` |: |
| Breadcrumbs | `breadcrumb` | ✅ shadcn | `ui/breadcrumb` |: |

### 0.2 The list engine (list = FilterBar → data-grid-6 → footer)

| Piece | ReUI / source | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| **Data grid** ("data-grid-6") | `data-grid-base-6` block | ✅ vendored | `molecules/Table` (`FlexpriceTable`) | [preview](https://reui.io/preview/base/data-grid-base-6) |
| Grid engine (columns, sort, pagination) | `@reui/data-grid` family | ✅ vendored | `FlexpriceTable` + `ColumnData<T>` | [docs](https://reui.io/docs/components/base/data-grid) |
| Grid toolbar / footer | `GridToolbar` / `GridFooter` | 🧩 `@fp/ui` | Table `Toolbar` + pagination |: |
| Loading rows | `LoadingRows` / `c-data-grid-21` | 🧩 / ➕ | `QueryableDataArea/LoadingState` | [preview](https://reui.io/preview/base/components/c-data-grid-21) |
| Empty (no data / no results) | `empty-state-2`, `c-empty-10`, `icon-stack` | 💲 / free / ➕ | `atoms/EmptyState`, `NoDataCard` | [preview](https://reui.io/preview/base/empty-state-2) · [preview](https://reui.io/preview/base/components/c-empty-10) |
| Error / permission state | `ListState` / `ErrorState` | 🧩 `@fp/ui` | `QueryableDataArea/ErrorState` |: |
| Column controls (density, visibility) | `data-grid-columns-3` | 💲 (use once >8 cols) |: | [preview](https://reui.io/preview/base/data-grid-columns-3) |
| Row expand into detail | `data-grid-expansion-3` / `c-data-grid-8` | 💲 / free |: | [preview](https://reui.io/preview/base/data-grid-expansion-3) |

### 0.3 The filter primitive (the "filter" piece)

| Piece | ReUI / source | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Filter builder (fields → operators → values) | `@reui/filters` (+ `cascader` dep) | ➕ | `molecules/QueryBuilder` + `FilterPopover` | [docs](https://reui.io/docs/components/base/filters) |
| Filter bar (simple, URL-friendly) | `FilterBar` | 🧩 `@fp/ui` | `QueryBuilder` toolbar |: |
| Sort menu | `SortMenu` | 🧩 `@fp/ui` | `SortDropdown` |: |
| Filters + grid, worked together | `c-filters-10` / `data-grid-filtering-4` | free / 💲 | `QueryableDataArea` | [preview](https://reui.io/preview/base/components/c-filters-10) |
| Search input | `input` + lucide `Search` | ✅ | `atoms/Input suffix={<Search/>}` |: |

> ⚠️ `@reui/filters` pulls ~25 registry deps (the whole `cascader` family) and its
> AND/OR tree can't round-trip through the URL search-param codec. For most catalog
> lists the lighter **`FilterBar` + `SortMenu`** over `data-grid-base-6`'s tabbed
> filters is enough. Reserve the full builder for high-cardinality lists (Features).

### 0.4 Row & cell primitives

| Piece | ReUI | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Status chip / type chip | `badge` (`-light`/`-outline` variants) | ✅ | `atoms/Chip` (chip-type-metered/boolean/static/config) | [docs](https://reui.io/docs/components/base/badge) |
| Row action menu (⋯) | `dropdown-menu` | ✅ shadcn | `molecules/DropdownMenu` |: |
| Row media / source mark | `icon-tile` | ➕ |: (new) | [docs](https://reui.io/docs/components/base/icon-tile) |
| Money / metric cells | `Money`, `Metric` | 🧩 `@fp/ui/flexprice` | domain cells |: |
| Copy-id, redirect cell | `dropdown-menu` + `sonner` | ✅ / ➕ | `Table/RedirectCell`, `TooltipCell` |: |
| Confirm (archive/delete) + undo | `alert-dialog` + `sonner` toast | ➕ | `atoms/Dialog` confirm | [preview](https://reui.io/preview/base/profile-10) |

### 0.5 Detail drawer

| Piece | ReUI | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Right-side detail / quick-edit | `sheet-9` (inline editing) / `c-sheet-4` / `sheet` | 💲 / free / ✅ | `ui/sheet` (all `*Drawer` molecules) | [preview](https://reui.io/preview/base/sheet-9) · [preview](https://reui.io/preview/base/components/c-sheet-4) |

### 0.6 Form primitives (V1 has no form lib: local state + Zod on submit; keep that)

| Piece | ReUI / shadcn | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Field wrapper (label + desc + error) | `Field`, `Section` | 🧩 `@fp/ui` | `atoms/Input` self-wrapping fields |: |
| Text / number amount | `input`, `number-field` | ✅ / ➕ | `atoms/Input variant=number` | [docs](https://reui.io/docs/components/base/number-field) |
| Select / searchable select | `select`, `combobox` | ✅ / ➕ | `atoms/Select`, `Combobox` |: |
| Async entity picker | `autocomplete` | ➕ | `AsyncSearchableSelect` | [docs](https://reui.io/docs/components/base/autocomplete) |
| Boolean toggle row | `switch` | ➕ | `atoms/Toggle` |: |
| Segmented (e.g. Fixed / Usage) | `toggle-group` | ➕ | `atoms/SegmentedControl` |: |
| Dates (start/end, redeem, anchor) | `date-selector` / `calendar` | ➕ | `atoms/DatePicker`, `DateRangePicker` | [docs](https://reui.io/docs/components/base/date-selector) |
| **Advanced** collapse (progressive disclosure) | `collapsible` | ➕ |: (new; see V2 rule) |: |
| Structured/JSON value (CONFIG, metadata) | `code-block` / `tree` | ➕ | `ui/JsonEditor` | [docs](https://reui.io/docs/components/base/code-block) |
| Tier / order reordering | `sortable` | ➕ | `ui/sortable` | [docs](https://reui.io/docs/components/base/sortable) |

### 0.7 Wizard (multi-step editors: plan/feature creation)

| Piece | ReUI | Status | flexprice-front parity | Link |
|---|---|---|---|---|
| Stepper shell (step state in URL) | `WorkflowStepper` over `@reui/stepper` | 🧩 / ✅ | `atoms/Stepper` | [docs](https://reui.io/docs/components/base/stepper) |
| Live preview rail (bill/proration) | `wizard-4` / `solution-billing-8` | 💲 |: (new; the V2 headline) | [preview](https://reui.io/preview/base/wizard-4) · [preview](https://reui.io/preview/base/solution-billing-8) |
| Per-step validation + review | `wizard-1` | 💲 |: | [preview](https://reui.io/preview/base/wizard-1) |

---

## 1. Features  ·  route `/features`  ·  build order #1  (partially built)

> Already built: `FeatureListPage`, `FeatureCreatePage`, `@fp/ui/flexprice`
> `FeatureGrid` + `FeatureForm`. This is the reference pattern for every other entity.

### 1.1 Features: list (`/features`)

| Sub-component | ReUI | Status | V1 parity |
|---|---|---|---|
| Page shell | `PageHeader`+`PageToolbar`+`PageBody` | 🧩 | `Features.tsx` |
| Grid | `data-grid-base-6` via `FeatureGrid` | ✅🧩 | columns: name · group · type · status · updated · ⋯ |
| Filter | `FilterBar` (name, created-at, status, type, group) → `@reui/filters` if needed | 🧩/➕ | V1 filters |
| Sort | `SortMenu` (name, created-at, updated-at) | 🧩 | V1 sorts |
| Type chip | `badge` `-light` (metered/boolean/static/config) | ✅ | `Chip` type tokens |
| Status chip | `badge` (published/archived) | ✅ | `Chip` |
| Row ⋯ (Edit → drawer) | `dropdown-menu` + `sheet` | ✅ | `FeatureDrawer` |

### 1.2 Features: create (`/features/new`): the hardest V1 screen, made progressive

Full page, `FeatureForm`. V1 fields that must all survive (from the functional map):

| Section | Sub-component | ReUI | Status | V1 fields covered |
|---|---|---|---|---|
| Details | `Field`/`Section` + `input` | 🧩/✅ | `name` (derives `lookup_key` + meter name), `description`, `lookup_key` |
| Type chooser | `radio-group` cards + `badge` | ✅ | `type` METERED·BOOLEAN·STATIC·CONFIG (**create-only**: state it here) |
| Units (metered) | `input` | ✅ | `unit_singular`/`unit_plural` |
| Reporting/display unit (metered) | `input` + `number-field` | ✅/➕ | `reporting_unit.{unit_singular,unit_plural,conversion_rate}` |
| Group | `combobox`/`autocomplete` | ➕ | `group_id` (entity_type=feature) |
| **Meter: event** (metered) | `input` + `filters`/repeatable rows | ✅/➕ | `event_name`, `filters[{key,values[]}]` |
| **Meter: aggregation** (metered) | `select` + plain-language labels w/ API value shown | ✅ | `aggregation.type` (SUM·COUNT·COUNT_UNIQUE·SUM_WITH_MULTIPLIER·LATEST·MAX·WEIGHTED_SUM·AVG) |
| Aggregation field / expression (XOR) | `toggle-group` + `input` (`code-block` for CEL) | ➕ | `aggregation.field` XOR `aggregation.expression` (CEL) |
| Multiplier | `number-field` | ➕ | `aggregation.multiplier` (SUM_WITH_MULTIPLIER, >0) |
| Advanced meter | `collapsible` | ➕ | `aggregation.group_by`, `aggregation.bucket_size`, `reset_usage` |
| Alerts | `Section` + `number-field` + `switch` | ➕ | `critical/warning/info {threshold,condition}`, `alert_enabled` |
| Worked-example preview | side panel (`code-block`) | ➕ | live cURL + sample-event result (V2 addition) |

### 1.3 Features: detail (`/features/:id`)

| Sub-component | ReUI | Status | V1 parity |
|---|---|---|---|
| Linked entitlements grid | `data-grid-base-6` | ✅ | `FeatureDetails` entitlements |
| Meter-inline expand | `data-grid-expansion-3` | 💲 | show meter inside the row |
| Alert settings card | `card` + `switch`/`number-field` | ✅/➕ | Alert Settings |
| "Ingest an event" action | `button` + `code-block` | ✅/➕ | ingest action |

### 1.4 Features: edit (drawer, 6 fields)

`sheet` + `Field`: `name`, `description`, `group_id`, `unit_singular`, `unit_plural`,
`reporting_unit.*`. **State that `type` + the meter are not editable** (`alert`, ➕).

---

## 2. Plans  ·  route `/plans`  ·  build order #2  (placeholder)

Four surfaces in V1 collapse into **one stepper** (Details → Charges → Entitlements →
Credits → Review), step state in the URL.

### 2.1 Plans: list (`/plans`): ship as a view toggle

| Sub-component | ReUI | Status | V1 parity |
|---|---|---|---|
| **Pricing view** (default) | `pricing-1` (tiers side-by-side, monthly/yearly, seat stepper) | 💲 | "plans read as pricing" (V2) |
| **Operator grid view** | `data-grid-base-7` (row-per-plan, status, actions) | 💲 | `Plans.tsx` list (name · status · updated) |
| View switch | `toggle-group` | ➕ |: |
| Entitlement matrix (optional) | `comparison-1` (`surface: none`) | 💲 | cross-plan entitlements |
| Row ⋯ | `dropdown-menu` | ✅ | Edit·Duplicate·Archive·Copy ID (V1 `ActionButton`) |
| "Create with AI" CTA | `button` (WandSparkles) | ✅ | V1 header CTA → pricing-setup (RBAC plan+feature write) |

### 2.2 Plans: create/edit (stepper)

**Step 1 · Details**: `form-12` shape (`Field`/`Section` + `input`/`textarea`): `name`,
`lookup_key`, `description`, `metadata`.: 💲/🧩

**Step 2 · Charges**: the largest V1 surface. Charges are rows edited one at a time:

| Sub-component | ReUI | Status | V1 fields covered |
|---|---|---|---|
| Per-row inline editor | **`data-grid-editing-4`** 🔒 | 💲 | the Charges table (checkout-a-row → inline inputs → Save/Cancel) |
| Fixed vs Usage switch | `toggle-group` | ➕ | `type` FIXED\|USAGE, `billing_cadence` |
| Amount / display amount | `number-field` | ➕ | `amount`, `display_amount`, `min_quantity` |
| Billing model | `select` + explainer | ✅ | FLAT_FEE·PACKAGE·Volume TIERED·Slab TIERED·Percentage (Volume vs Slab shown with both totals) |
| Tiers editor | table + `sortable` + `number-field` | ➕ | `tiers[{up_to,unit_amount,flat_amount}]` (only last `up_to:null`) |
| Package transform | `number-field` + `select` | ➕ | `transform_quantity{divide_by,round}` |
| Currency / price unit | `select` | ✅ | `currency`, `price_unit_type` FIAT\|CUSTOM, `price_unit_config` |
| Billing period / count | `select` + `number-field` | ✅/➕ | `billing_period` (DAILY…ANNUAL\|ONETIME), `billing_period_count` |
| Invoice cadence | `toggle-group` | ➕ | `invoice_cadence` ADVANCE\|ARREAR |
| Usage: meter + filter values | `autocomplete` + `filters` | ➕ | `meter_id`, `filter_values`, price-level `bucket_size` |
| Fixed: trial + contract calc | `number-field` | ➕ | `trial_period_days`, contract back-calc |
| Advanced | `collapsible` | ➕ | `lookup_key`, `description`, `group_id`, `start_date`/`end_date`, `metadata`, `parent_price_id` |
| **Live bill preview rail** | `wizard-4` rail | 💲 | "customer on this plan pays $X" (V2 headline) |

**Step 3 · Entitlements**: `data-grid-base-6` add/edit rows (replaces `AddEntitlementDrawer`):
`feature_id`, `is_enabled` (BOOLEAN), `usage_limit`+`is_soft_limit`+`usage_reset_period`
(METERED), `static_value` (STATIC), `config_value` (CONFIG via `code-block`), `display_order`
(`sortable`), `start_date`/`end_date`, `entity_type`, `parent_entitlement_id`. Value calculator
in reporting units.: ✅/➕

**Step 4 · Credit Grants**: `card` rows (replaces `CreditGrantModal`): `name`, `credits`
(`number-field`), `cadence` ONETIME\|RECURRING, `period`+`period_count`, `expiration_type`
NEVER\|DURATION\|BILLING_CYCLE (+`expiration_duration`/`unit`), `priority`, `scope`,
`conversion_rate`/`topup_conversion_rate`, `credit_grant_anchor`, `start_date`/`end_date`.: ✅/➕

**Step 5 · Review**: `wizard-1` review summary + full bill preview.: 💲

### 2.3 Plans: detail / manage (`/plans/:id`)

Read/manage view (V1 `PlanDetailsPage`, hand-rolled button tabs → real `tabs`).

| Sub-component | ReUI | Status | V1 parity |
|---|---|---|---|
| Tab bar (Overview·Entitlements·Credit Grants·Information) | `tabs` | ✅ | custom `<button>` nav |
| Charges table (Overview) | `data-grid-base-6` | ✅ | `PlanPriceTable`: Display Name · Charge Type & Timing chip · Billing Period · Bucket Size chip · Status chip · Value |
| Price row ⋯ | `dropdown-menu` | ✅ | `PriceDropdown`: Copy Price ID · Update Price · Edit Details · Terminate Price |
| "Sync Usage Charges" + workflows | `button` + `tooltip` | ✅ | Temporal sync action; view-workflows |
| Metadata editor | `dialog` + `code-block` | ✅/➕ | `MetadataModal` |
| Integration mapping | `card` | ✅ | `IntegrationMappingCard` |
| Price edit/terminate | `sheet` / `alert-dialog` | ✅/➕ | `UpdatePriceDetailsDrawer`, `TerminatePriceModal` |

---

## 3. Add-ons  ·  route `/addons`  ·  build order #3  (placeholder)

Structurally a Plan that can't be sold alone: **reuse the Plans stepper minus the
sellable bits**. Shares Charges + Entitlements + Credit Grants outright.

| Page | Sub-components | ReUI | Status |
|---|---|---|---|
| List | grid + status/type chips + ⋯ | `data-grid-base-6` + `badge` + `dropdown-menu` | ✅ |
| Create/edit | Details + Charges + Entitlements + Credit Grants (same as Plans §2.2) | `@reui/data-grid` + `WorkflowStepper` | ✅/🧩 |

V1 fields: `name`, `description`, `lookup_key`, `metadata` + Charges + Entitlements +
Credit Grants (all as in §2.2).

---

## 4. Coupons  ·  route `/coupons`  ·  build order #4  (placeholder)

| Page | Sub-component | ReUI | Status | V1 fields covered |
|---|---|---|---|---|
| Manager (list + inline edit) | **`solution-billing-9`** 🔒 | 💲 | discount type, duration, redemption limits, eligible plans: field for field |
| Fallback (card-surface) | `data-grid-base-6` + row expand | ✅ | neutral grid if frame is a blocker |
| Detail card | `coupon-4` (copyable code, expiry) | 💲 | detail view (V1 detail is **read-only**; edit via drawer) |
| Editor (drawer) fields | `sheet` + `select`/`number-field`/`date-selector` | ✅/➕ | `type` fixed\|percentage, `amount_off`\|`percentage_off`, `currency`, `cadence` once\|repeated\|forever, `duration_in_periods`, `coupon_code`, `redeem_after`/`redeem_before`, `max_redemptions`, `total_redemptions`, `rules` |

---

## 5. Cost Sheets  ·  route `/cost-sheets`  ·  independent  (placeholder)

Same charge machinery as a Plan, pointed at **cost** (so margin is computable). Say
that once, in Setup.

| Page | Sub-components | ReUI | Status |
|---|---|---|---|
| List | grid + ⋯ | `data-grid-base-6` | ✅ |
| Editor | Details (`name`, `description`, `lookup_key`) + **Charges** (same as §2.2 Step 2) | `data-grid-editing-4` 🔒 / `@reui/data-grid` | 💲/✅ |

---

## 6. Price Units  ·  route `/price-units`  ·  independent  (placeholder)

Plain 5-field list: do **not** install the filter builder here.

| Page | Sub-components | ReUI | Status | V1 fields |
|---|---|---|---|---|
| List | `data-grid-base-6` | ✅ | `name`, `code` (3 chars), `symbol`, `base_currency`, `conversion_rate` |
| Create/edit | `sheet` + `Field` + `input`/`number-field` | ✅/➕ | same |

> V1 has **no detail page** and rows aren't clickable: manage entirely from the list + drawer.

---

## 7. Groups  ·  route `/groups`  ·  independent  (placeholder)

| Page | Sub-components | ReUI | Status | V1 fields |
|---|---|---|---|---|
| List | `data-grid-base-6` + `badge` (type: price\|feature) | ✅ | `name`, `lookup_key`, `entity_type`, status |
| Create/edit | `sheet` + `Field` + multi-select `autocomplete` (`entity_ids[]`) + `tree` (nested) | ➕ | `entity_ids[]` |
| Profile / detail (`/groups/:id`) | `tabs` (Overview·Information) + `data-grid-base-6` | ✅ | Overview switches on `entity_type`: **price** → charges grid, **feature** → features grid |

---

## 8. Install summary

From [`reui-components.md`](./reui-components.md). Already vendored: `data-grid`
(+ `data-grid-base-6`), `badge`, `stepper`, `frame`, `cascader`, `icon-stack`; shadcn
`button`/`input`/`select`/`sheet`/`dialog`/`dropdown-menu`/`table`/`tabs`/`checkbox`/
`radio-group`/`popover`/`tooltip`/`skeleton`/etc.

```bash
# ReUI components the catalog needs
pnpm ui:add filters number-field date-selector icon-tile autocomplete \
            sortable tree code-block collapsible alert

# shadcn items the catalog needs
pnpm ui:add combobox calendar switch toggle-group alert-dialog empty sonner
```

Pro blocks (install per surface, mind the 🔒 frame flag): `pricing-1`,
`data-grid-base-7`, `comparison-1`, `data-grid-editing-4` 🔒, `form-12`, `form-3`,
`solution-billing-9` 🔒, `coupon-4`, `wizard-4`, `wizard-1`, `solution-billing-8`,
`data-grid-columns-3`, `data-grid-expansion-3`, `empty-state-2`, `sheet-9`.

---

## Open decisions

1. **Two best-fit blocks are `frame`**: `data-grid-editing-4` (Plan/Cost-Sheet
   charges editor) and `solution-billing-9` (Coupons). Convert to `card` (smaller
   cost) or accept a second surface. Card-surface fallbacks: `data-grid-base-6` with
   row expand.
2. **`@reui/filters` is heavy** (~25 deps incl. `cascader`) and its AND/OR tree can't
   round-trip the URL codec. Use `FilterBar`/`SortMenu` for most catalog lists;
   reserve the full builder for Features.
3. **Grid = TanStack migration.** `data-grid-base-6` is TanStack Table v9; V1's
   `FlexpriceTable` used a `fieldName | render` column union. Column defs are rewritten,
   not restyled: but greenfield, so no V1 code is touched.
4. **Theme divergence is intentional.** Console is `base-nova` + Tailwind v4; point
   ReUI `primary` at the console's brand token, not V1's navy `#092e44`.
5. **Live preview (`wizard-4` rail) is the highest-value V2 element** and the biggest
   build. It can be folded into the Plans stepper's Charges step incrementally.

# ReUI suggestions, surface by surface

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

For every Flexprice screen: 2–3 candidates, with links, and why one wins.

**Licence:** `pro`: every block below is installable. All 22 components and all
`c-*` examples are free.
**Surface lock:** `card`. Blocks marked **`frame`** are the other ReUI surface:
adopting one means either converting it or breaking the lock. Flagged where it
matters.

---

## Home

### Overview dashboard

| Option | Links | Why |
|---|---|---|
| **`dashboard-2`** ← | [preview](https://reui.io/preview/base/dashboard-2) · [docs](https://reui.io/blocks/application/dashboard/dashboard-2) | Three area-chart metric cards over a searchable DataGrid. Closest to what Home should be: a few numbers, then the list you act on. Ships a navbar to delete. |
| `dashboard-5` | [preview](https://reui.io/preview/base/dashboard-5) | The only block with value + delta + **sparkline** in one tile. Take the tile row, drop the rest. |
| `stats-2` | [preview](https://reui.io/preview/base/stats-2) | Cleanest KPI-row semantics, least adaptation: but no sparkline, and solid colour blocks fight a neutral billing palette. |

**Reason:** MRR, active subscriptions, overdue invoices and usage this period are
four numbers, not a dashboard. `dashboard-2`'s proportion: small metric row,
large table: matches how a finance person actually opens the app.

---

## Product Catalog

### Plans: list

| Option | Links | Why |
|---|---|---|
| **`pricing-1`** ← | [preview](https://reui.io/preview/base/pricing-1) | A 4-tier pricing table with a monthly/yearly toggle and a seat stepper that reprices. Plans *are* a pricing table; this is the artefact you're editing. |
| `data-grid-base-7` | [preview](https://reui.io/preview/base/data-grid-base-7) | Row-per-plan with status badges and row actions. Better for operating on 40 plans than for reading 4. |
| `comparison-1` | [preview](https://reui.io/preview/base/comparison-1) | Grouped feature rows with sticky labels: the entitlement matrix across plans. `surface: none`, so safe. |

**Reason:** `pricing-1` shows what a customer sees; the grid shows what an
operator manages. Ship both as a view toggle rather than choosing.

### Plans: editor

| Option | Links | Why |
|---|---|---|
| **`data-grid-editing-4`** ← | [preview](https://reui.io/preview/base/data-grid-editing-4) | **Pricing Plan Editor** with per-row edit mode: the table is read-only until a row is checked out, fields become inline inputs bound to one draft, Save/Cancel commits that row alone. Exactly the Charges table. **`surface: frame`.** |
| `form-12` | [preview](https://reui.io/preview/base/form-12) | Product-creation form: status, currency-prefixed pricing, toggles, multi-select. The Plan details half. |
| `form-3` | [preview](https://reui.io/preview/base/form-3) | Editable line-items table with live subtotal/tax/total: the pattern for prices with a running total. |

**Reason:** a Plan's Charges are rows edited one at a time, not a form saved in
bulk. `data-grid-editing-4` is the only block that models that. The `frame`
surface is the cost: decide whether to convert it or accept a second surface.

### Coupons

| Option | Links | Why |
|---|---|---|
| **`solution-billing-9`** ← | [preview](https://reui.io/preview/base/solution-billing-9) | **Coupon and promotion manager**: each row expands inline to edit discount type, duration, redemption limits and eligible plans. That is our coupon model, field for field. **`surface: frame`.** |
| `coupon-4` | [preview](https://reui.io/preview/base/coupon-4) | Coupon card with copyable code, expiry, minimum spend. `card` surface. Good for a detail view, not a manager. |
| `data-grid-base-6` | [preview](https://reui.io/preview/base/data-grid-base-6) | Plain grid with tabbed filters and hover actions: the neutral fallback if the frame surface is a blocker. |

**Reason:** `solution-billing-9` already has cadence, duration and redemption
limits as an inline editor. Nothing else in the registry knows what a coupon is.

### Features · Addons · Cost Sheets · Price Units · Groups

| Option | Links | Why |
|---|---|---|
| **`@reui/data-grid` + our `FeatureGrid`** ← | [docs](https://reui.io/docs/components/base/data-grid) | Already vendored and already the pattern. These five are ordinary lists; a block would add chrome, not capability. |
| `data-grid-columns-3` | [preview](https://reui.io/preview/base/data-grid-columns-3) | Display popover with density, sticky header, column visibility: worth it once a list exceeds ~8 columns. |
| `data-grid-expansion-3` | [preview](https://reui.io/preview/base/data-grid-expansion-3) | Rows expand into detail cards: useful for a Feature showing its Meter inline. |

**Reason:** don't install a block to render a list we already render.

---

## Billing

### Customers: detail

| Option | Links | Why |
|---|---|---|
| **`solution-billing-4`** ← | [preview](https://reui.io/preview/base/solution-billing-4) | **Customer billing account detail**: identity header, tabbed invoice history / subscription / payment methods, beside a scoped activity timeline. Our customer page, with our nouns. `surface: card`. |
| `profile-8` | [preview](https://reui.io/preview/base/profile-8) | Plan summary, 3-column usage metrics, invoice history table. Better for the *customer's own* portal view. |
| `solution-crm-*` | [browse](https://reui.io/blocks/solutions/crm) | Account-centric layouts if the customer page grows relationship data. |

**Reason:** `solution-billing-4` is the single closest block to a Flexprice
screen anywhere in the registry: right domain, right surface, right structure.

### Subscriptions

| Option | Links | Why |
|---|---|---|
| **`solution-billing-8`** ← | [preview](https://reui.io/preview/base/solution-billing-8) | **Subscription plan change wizard with live proration preview**: a rail recomputing credit, charge and due-today as plan and timing change. Upgrade/downgrade is our hardest flow and this is it, built. |
| `wizard-4` | [preview](https://reui.io/preview/base/wizard-4) | Four-step billing wizard with a live invoice preview sidebar. The creation counterpart. |
| `wizard-1` | [preview](https://reui.io/preview/base/wizard-1) | Three steps, per-step validation, review summary: maps 1:1 onto our `WorkflowStepper`. |

**Reason:** proration is the thing people get wrong and can't check. A rail that
recomputes due-today as you change the plan is the whole feature.

### Invoices

| Option | Links | Why |
|---|---|---|
| **`solution-billing-1`** ← | [preview](https://reui.io/preview/base/solution-billing-1) | Statement summary + past-due alert + filterable invoice ledger, with Filters, detail sheet and skeletons wired. Covers the list, the toolbar, the drawer and the loading state in one install. |
| `solution-billing-5` | [preview](https://reui.io/preview/base/solution-billing-5) | Four-step invoice builder with a live receipt-style review. For manual invoices. |
| `receipt-2` | [preview](https://reui.io/preview/base/receipt-2) | Status hero, line items, totals breakdown, Bill To block: the invoice *document* view. |

**Reason:** our `InvoiceGrid` already does the table. `solution-billing-1` adds
what it lacks: the summary above it and the past-due callout.

### Payments · Credit Notes · Taxes

| Option | Links | Why |
|---|---|---|
| **`@reui/data-grid`** ← | [docs](https://reui.io/docs/components/base/data-grid) | Three more lists. Same grid, different columns. |
| `c-data-grid-24` | [preview](https://reui.io/preview/base/components/c-data-grid-24) | Column totals footer: a real `<tfoot>`, which Payments and Credit Notes both want. |
| `receipt-2` | [preview](https://reui.io/preview/base/receipt-2) | Credit note as a document, if it needs to be printable. |

---

## Revenue

| Option | Links | Why |
|---|---|---|
| **`c-chart-17`** ← | [preview](https://reui.io/preview/base/components/c-chart-17) | Forecast line chart with a striped projection zone. Free, two deps, purpose-built. The one clean hit in this section. |
| `chart-20` | [preview](https://reui.io/preview/base/chart-20) | Dashed vertical `ReferenceLine` + money-formatted axis: lift these onto any other chart for an "as of today" marker. |
| `solution-analytics-5` | [preview](https://reui.io/preview/base/solution-analytics-5) | Metrics grid over a dense table with a detail drawer: the shape for any revenue report. |

**Reason and the caveat:** ReUI has **no chart component**: the category is
shadcn `chart` + Recharts, and ReUI adds styling recipes. There is **no
waterfall, no box plot and no pivot builder**, so ARR bridge, days-to-pay and
deferred rollforward are compositions, not installs. Named honestly rather than
matched badly.

---

## Developers

### Events Debugger

| Option | Links | Why |
|---|---|---|
| **`solution-analytics-5`** ← | [preview](https://reui.io/preview/base/solution-analytics-5) | **Event Explorer**: event catalog with a health metrics grid, dense table, filtering, and a detail drawer. Built for exactly this job. |
| `agent-activity-2` | [preview](https://reui.io/preview/base/agent-activity-2) | Summary / Detailed / **Raw monospace** log views with copy and download. The raw view is what debugging needs. |
| `@reui/code-block` | [docs](https://reui.io/docs/components/base/code-block) | Shiki highlighting, streaming, diffs, per-line interaction: for the event payload itself. |

### API Keys · Service Accounts

| Option | Links | Why |
|---|---|---|
| **`profile-10`** ← | [preview](https://reui.io/preview/base/profile-10) | **Developer API keys page**: masked token copy, roll and revoke, delete once revoked, confirm dialogs with undo toasts, and SDK samples in 5 languages. Nothing to design. |
| `solution-users-4` | [preview](https://reui.io/preview/base/solution-users-4) | Invitations queue with status filter and bulk revoke: the same lifecycle, for service accounts. |
| `profile-9` | [preview](https://reui.io/preview/base/profile-9) | Settings hub whose 11 panels already include API keys, webhooks and audit. |

**Reason:** `profile-10` handles the parts that are easy to get wrong: masking,
roll-then-revoke ordering, and confirmation with undo.

### Webhooks · Workflows · Exports · Usage Syncs

| Option | Links | Why |
|---|---|---|
| **`solution-agents-7`** ← | [preview](https://reui.io/preview/base/solution-agents-7) | Failed-run triage grid with metric cards, and a detail sheet tabbed into **error / retry attempts / payload**. That is a webhook delivery log and a workflow run, under different nouns. |
| `@reui/timeline` | [docs](https://reui.io/docs/components/base/timeline) | Attempt history per delivery. |
| `agent-activity-4` | [preview](https://reui.io/preview/base/agent-activity-4) | Rows streaming in over skeletons: right for a live tail. |

**Reason:** the registry has no webhook block. It has a retry-and-payload triage
block, which is the same screen. Relabel rather than rebuild.

---

## Integrations

| Option | Links | Why |
|---|---|---|
| **`dialog-6`** ← | [preview](https://reui.io/preview/base/dialog-6) | Searchable integration grid of brand-logo cards with single-select and a disabled-until-picked footer. The connect flow. |
| `dialog-14` | [preview](https://reui.io/preview/base/dialog-14) | OAuth consent modal with paired provider logos and a scope picker: the step after. |
| `c-item-11` | [preview](https://reui.io/preview/base/components/c-item-11) | Integration rows with connect actions: free, for the directory itself. |

**Reason:** the two dialogs cover connect and consent; the directory is a list we
can build. Note ReUI ships **no brand logos**: those are ours to supply.

---

## Pricing Widget

| Option | Links | Why |
|---|---|---|
| **`pricing-1`** ← | [preview](https://reui.io/preview/base/pricing-1) | Monthly/yearly toggle, featured tier, tiers listing only what they add, per-seat stepper. It is the embeddable widget. |
| `comparison-1` | [preview](https://reui.io/preview/base/comparison-1) | Grouped specs with sticky labels: for a long entitlement comparison. |
| `checkout-2` | [preview](https://reui.io/preview/base/checkout-2) | Multi-step checkout with a sticky order summary, if the widget transacts. |

---

## Settings

| Option | Links | Why |
|---|---|---|
| **`profile-9`** ← | [preview](https://reui.io/preview/base/profile-9) | Collapsible grouped sidebar switching 11 card-based panels: authentication, profile, billing, API keys, webhooks, audit. Scales as settings grow. |
| `settings-7` | [preview](https://reui.io/preview/base/settings-7) | Side-tab rail, lighter. Right if settings stay under ~6 sections. |
| `profile-2` | [preview](https://reui.io/preview/base/profile-2) | Line tabs with a members DataGrid and a **permission checkbox matrix**: take this for Members and Roles specifically. |

**Reason:** we already have 7 catalogue entities and environments to manage;
settings will grow. A sidebar absorbs that, a tab rail doesn't.

---

## Cross-cutting

| Need | Option | Links |
|---|---|---|
| **Empty states** | `empty-state-2` (no-results + suggestion chips) · `c-empty-10` (free, message + reset) · `@reui/icon-stack` | [preview](https://reui.io/preview/base/empty-state-2) · [preview](https://reui.io/preview/base/components/c-empty-10) |
| **Filtering** | `@reui/filters` · `c-filters-10` (builder + totalled grid) · `data-grid-filtering-4` (pinned at-risk rows) | [docs](https://reui.io/docs/components/base/filters) · [preview](https://reui.io/preview/base/components/c-filters-10) · [preview](https://reui.io/preview/base/data-grid-filtering-4) |
| **Detail drawer** | `sheet-9` (inline editing) · `c-sheet-4` (free, scrollable) · `Sheet` (installed) | [preview](https://reui.io/preview/base/sheet-9) · [preview](https://reui.io/preview/base/components/c-sheet-4) |
| **Source marks** | `@reui/icon-tile` · `c-icon-tile-5` (size scale) · `c-icon-tile-6` (circular) | [docs](https://reui.io/docs/components/base/icon-tile) · [preview](https://reui.io/preview/base/components/c-icon-tile-5) |
| **Table loading** | `c-data-grid-21` (grid-driven skeletons) · `c-skeleton-5` (standalone) · `DataGridPagination` skeleton props | [preview](https://reui.io/preview/base/components/c-data-grid-21) |
| **Confirmations** | `alert-dialog` + undo toast, as `profile-10` does it | [preview](https://reui.io/preview/base/profile-10) |

---

## Three decisions this raises

1. **Two blocks that fit best are `frame` surface**: `solution-billing-9`
   (coupons) and `data-grid-editing-4` (plan editor). Convert them to `card`,
   or accept a second surface. Converting is the smaller cost; mixing is what
   the lock exists to prevent.

2. **No brand logos, no waterfall, no box plot, no pivot builder.** Source
   marks, the ARR bridge, days-to-pay and the rollforward matrix are ours to
   build. Motion Icons are Ultimate-locked on a Pro key and are UI glyphs, not
   brand marks: don't plan around them.

3. **`@reui/filters` costs 25 registry dependencies** including the whole
   `cascader` family, and its value is a nested AND/OR tree our URL search-param
   codec cannot round-trip. Worth it for Invoices and Customers; not worth it
   for Price Units.

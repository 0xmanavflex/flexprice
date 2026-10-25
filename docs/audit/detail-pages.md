# Detail pages: audit and redesign plan

Screenshots of the current state are in [`./detail-pages/`](./detail-pages/) (captured against mocked data, 1440×900).

The verdict, plainly: the detail pages read like a **Storybook of the design system**, not a
market-grade billing product. The problems are structural, not cosmetic: so the fix is a shared
detail shell + real relational content, not per-page tweaks.

---

## Cross-cutting mistakes

1. **Two header systems, applied backwards.** Plan and Coupon use `PageHeader`; Feature, Add-on,
   Cost-sheet, Price-unit, Group use `DetailHeader`. They differ in breadcrumb style (bare `← Features`
   text vs. a chevron "Coupons" button), action placement, and: worst: only `DetailHeader` gets the
   stat rail, so the **flagship Plan page has no rail** while a currency factor (Price Unit) does.
   Titles are `text-xl`: small for a page.

2. **The stat rail shows metadata, not metrics: and duplicates the body.** `DetailStats` renders
   Status / Lookup key / Updated / Type: the *same fields* that reappear in the "Information" list
   ~40px below and in the header badges. Add-on shows Status/Lookup/Updated **twice**; Price Unit shows
   its four fields **three times** (rail + Overview tab + Information tab). The rail adds no
   information; it reads as filler. A real rail carries **money and counts** (MRR, active subscriptions,
   redemptions, event volume, margin).

3. **The sections that matter are permanent "coming soon" stubs.** Feature → Charges + Entitlements,
   Add-on → Prices, Cost-sheet → Prices, Group → Members are all empty states ("…once the X view
   lands"). Those are the exact questions a detail page exists to answer. 4 of 7 pages carry **zero
   relational data**.

4. **Everything is a read-only `<dl>` spec sheet.** The dominant element is a label→value list at
   `text-sm`. No metrics, no charts, no activity/timeline, no inline editing. Feature, Cost-sheet, and
   Group have **no edit action at all**.

5. **Flat hierarchy, oceans of whitespace.** Uniform title/body sizes, one card style for everything,
   no focal point: and because content is thin, the plan and price-unit pages are mostly empty below
   the fold.

6. **Destructive actions are inconsistent.** Plan entitlement/credit-grant deletes fire immediately
   with no confirmation; Coupon archive correctly uses `ConfirmDialog`. Risky in a billing tool.

7. **The best asset is hidden.** `PlanPreviewCard` (a customer's-eye live pricing card with an example
   bill) only renders inside the separate `/plans/$id/charges` route: never on the plan detail page,
   which is exactly where "what does this plan look like and cost" belongs.

---

## Per-page mistakes

### Plan: `plan-detail.png`
- Uses the plainer `PageHeader`; **no metrics** (no "from $X", no MRR, no subscriber count).
- Charges is a bare 4-column table; **you cannot edit or remove a charge from the detail page**: "Add
  charges" bounces to a separate route that opens **empty**, and there is no edit path for an existing
  charge at all.
- No pricing preview, no grouping (fixed vs. usage), no currency subheaders.
- "Sync usage charges" is an opaque primary action with no explanation of what it changes.
- Huge empty canvas below three rows. Information tab reinvents `DetailList` by hand and repeats header
  fields.

### Add charges: `plan-charges.png`
- A separate route, opened empty by design; the two-pane + live preview is good but under-used.
- Should be *on the plan page* (a drawer or inline section), pre-loaded with existing charges so it
  edits in place, not a detour.

### Feature: `feature-detail.png`
- Different header; Status shown 3× (badge + rail + Information). Aggregation/Unit shown twice.
- For a **metered** feature the money question: event volume over time, last seen: is entirely
  absent. Charges and Entitlements are both stubs, so a non-metered feature's Overview is two empty
  states. No edit action.

### Add-on: `addon-detail.png`
- The rail's 4th tile is **empty** (looks broken). Status/Lookup/Updated shown 2–3×.
- The one relational section (Prices) is a stub. No entitlements, no "included in plans", no adoption.

### Coupon: `coupon-detail.png`
- The strongest page (it has a real "Where used" table + confirmed archive), but: `width="narrow"`
  leaves a large empty left gutter; 11-row spec sheet including a **raw JSON metadata `<pre>` dump**;
  the key number (redemptions 213/500) is buried as a row instead of a headline.

### Price unit: `priceunit-detail.png`
- The most over-built: four fields (Code/Symbol/Base currency/Conversion rate) rendered **three
  times**. The Symbol shows a broken placeholder glyph. This entity probably shouldn't have a tabbed
  detail page at all.

### Group & Cost-sheet (not screenshotted: empty corpora)
- Members / Prices sections are stubs, so the page can't show its own contents. No edit/add actions.

---

## Updates needed (redesign plan)

**A. One shared detail shell** (built on ReUI **`solution-billing-4`**: identity header + tabs +
activity rail). Replace both `PageHeader`/`DetailHeader` uses on detail pages with it. Larger title,
status, a consistent breadcrumb, an actions cluster, and a **metrics** rail.

**B. Turn the rail into real metrics.** Redesign `DetailStats` to carry money + counts, never the
record's own attributes. Per entity:
- Plan → active subscriptions · MRR · "from $X / period" · currency
- Feature → events (period) + sparkline · plans using it · entitled usage
- Add-on → subscriptions with it · MRR contribution · included-in-plans count
- Coupon → redemptions used/limit · total discounted · redemption rate
- Cost-sheet → total cost · blended margin
- Group → member count by type · combined value

**C. Fill the stubbed relational sections** by reusing the read tables we already have
(`ChargeTable`, `EntitlementTable`, `CreditGrantTable`) plus new ones:
- Feature → "Charges pricing this feature" + "Plans/add-ons granting it"
- Add-on → Prices (reuse `ChargeTable`) + Entitlements + Included-in-plans
- Cost-sheet → Prices with **cost vs. list price + computed margin** per line and aggregate
- Group → Members table with add/remove + bulk actions

**D. Bring the charge flow onto the plan page** (ReUI **`solution-inventory-4`** line-item table):
- Charges become an **editable line-item table**: inline "Add fixed / Add usage" rows, the
  pricing-model switch (flat/package/tiered/volume/usage), tier editor, per-row edit/remove: matching
  V1's add-charge flow but **in place**, not a separate empty route.
- Surface `PlanPreviewCard` on the plan Overview (right rail) so the customer-facing price + example
  bill is always visible. Consider **`pricing-1`** for the tier visualization.

**E. Polish + safety.**
- Confirm every destructive action via `ConfirmDialog`.
- Render metadata as key/value rows, not a JSON `<pre>`.
- Promote the headline number (redemptions, price) out of the spec sheet.
- Collapse the Price-unit page to a single non-tabbed view with a live conversion example.
- Add a change/activity timeline (the rail slot in `solution-billing-4`).

**Build order:** Plan detail (shell + metrics + inline charges + preview) → Feature detail → Add-on →
Cost-sheet → Coupon (align to shell) → Price-unit (simplify) → Group.

New/changed components will each ship with a story (per the Storybook coverage rule) and, where a
journey changes, an e2e assertion.

---

## V1 flows to match and exceed (the "richer flows" reference)

From `flexprice-front` (`src/pages/product-catalog/`). V2 should keep the substance and fix the
structural weaknesses.

**The add-charge engine** (`components/organisms/EntityChargesPage/`): the flow the user means:
- **Staged bulk**: multiple fixed + usage charges are built up client-side (a reducer of
  `recurringCharges[]` + `usageCharges[]`, each NEW/EDIT/SAVED), then committed **atomically via one
  `CreateBulkPrice`**. V2 keeps the multi-charge staging + single save: not one charge per dialog.
- **Two axes**: pick charge **type** first (Fixed vs Usage, icon cards), then **billing model** per
  charge: **Flat · Package · Volume-Tiered · Slab-Tiered · Percentage**. Each model swaps the fields
  (flat amount; package price÷units; tier table; percentage %). A completed form collapses to a
  compact preview row with hover edit/remove.
- **Fixed form** fields: name, currency/price-unit selector (fiat or custom unit), billing period,
  billing model, group, start date (→ upcoming price), Advance/Arrear timing, min quantity, trial.
  **Usage form**: binds to a metered **Feature**, bucket size (locked when the meter defines one),
  else same models; usage is Arrear/period=1.
- **Tier editor**: From (read-only, auto-derived) | Up-to | per-unit price | flat fee | delete; last
  tier's Up-to is ∞; "+ Add tier" closes the previous bound.

**Versioned price editing** (per-charge `⋮` menu on the table): **Update Price** (a versioned change
with an "Effective From" date: schedule a future price, never hard-edit), **Edit Details** (metadata
drawer: name/description/lookup/group), **Terminate** (optional end date = schedule, empty =
immediate soft-terminate), **Copy ID**. V2 should offer edit/remove per charge (today V2 has neither).

**Entitlements** (`AddEntitlementDrawer`): stage **multiple** entitlements then bulk-save; per
feature-type config: metered (usage limit + "set infinite" + reset period + soft-limit toggle),
boolean (auto-enabled), static (value), config (JSON): with a display-unit calculator.

**Credit grants** (`CreditGrantModal`): one-time vs recurring, credits, conversion rate, top-up rate,
grant period, expiry (billing-cycle vs never), priority.

**Feature detail** extras worth porting: an **Alert Settings** dialog (Critical/Warning/Info
thresholds) and, for metered features, a live **"ingest an event" cURL snippet** built from the meter.

**V1 traps to FIX in V2:** add-charge is a separate full-page route that loses plan context and drops
draft state on navigate (→ do it in a drawer/inline on the plan); plan vs add-on use divergent code
paths for the same flow (→ unify); tables only allow delete, never edit (→ add edit); no confirmation
on archive (→ confirm). Percentage/Slab-Tiered are UI-only fictions in V1: represent them
first-class if the SDK allows.

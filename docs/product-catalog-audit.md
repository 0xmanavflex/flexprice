# The product catalogue, as it is today

An audit of V1's Product Catalog before redesigning it. Written from the code
(`flexprice-front`, `src/pages/product-catalog/**`, `src/components/organisms/PlanForm/**`,
`src/components/organisms/EntityChargesPage/**`) rather than from screenshots, so the
claims below are checkable.

The test this is measured against: **a finance person should be able to set up
pricing without asking an engineer what a word means.**

---

## 1. What the catalogue contains

Seven items in the sidebar:

| # | Entity | Route | Model |
|---|--------|-------|-------|
| 1 | Features | `/product-catalog/features` | `name, lookup_key, type, meter_id, unit_singular/plural, reporting_unit, group_id` |
| 2 | Plans | `/product-catalog/plans` | `name, lookup_key, description, metadata` |
| 3 | Coupons | `/product-catalog/coupons` | `type, cadence, amount_off \| percentage_off, currency, coupon_code, redeem_after/before, max_redemptions, duration_in_periods, rules` |
| 4 | Addons | `/product-catalog/addons` | `name, description, lookup_key, metadata` |
| 5 | Cost Sheets | `/product-catalog/cost-sheets` | `name, description, lookup_key, prices[]` |
| 6 | Price Units | `/product-catalog/price-units` | `name, code, symbol, base_currency, conversion_rate` |
| 7 | Groups | `/product-catalog/groups` | `name, lookup_key, entity_type (price\|feature), entity_ids[]` |

And three concepts that are **decisive but have no nav entry**:

| Concept | Lives inside | Why it matters |
|---------|--------------|----------------|
| **Meter** | created silently inside a Metered feature | Defines the event name and the aggregation. Determines every usage number the customer is ever billed for. |
| **Price / Charge** | added on a separate page, per plan / addon / cost sheet | *This is the money.* A plan without prices charges nothing. |
| **Entitlement** | a drawer on the plan's Entitlements tab | What the customer is allowed to use. |

So the catalogue is really **ten concepts presented as seven**, and the three
hidden ones are the three that decide what a customer pays.

---

## 2. Features

### 2.1 The list: `Features.tsx` (353 lines)

Columns: Feature name · Group · Type · Status · Updated at · row menu.
Filters: name, created-at, status (published/archived), type, group.
Sorts: name, created-at, updated-at.
Row menu: **Edit**: which opens a drawer, not the page the feature was created on.

### 2.2 Creating one: `AddFeature.tsx` (1,106 lines, the second-largest file in V1)

A full page, two columns. Left: three stacked cards. Right: a live cURL preview
of the event you would send.

**Card 1: Feature details**

- **Name.** Typing it silently derives `lookup_key` as `feat-<slug>` *and* sets
  the meter's name. One keystroke writes three fields.
- **Type.** Four options, each with a one-line description and an icon:
  - `METERED`: "varying usage that needs to be measured, i.e. API calls, LLM tokens"
  - `BOOLEAN`: "customers can either have access or not, i.e. SSO"
  - `STATIC`: "can be configured per customer, i.e. log retention period"
  - `CONFIG`: "structured key-value configuration, i.e. feature flags, limits map"
- Then a row of **`+` chips**: Lookup key · Unit name · Display unit name (metered
  only) · Feature description · Add group.

  The chips are the interesting part. Opening one **removes the whole chip row**
  and renders a *different* chip row further down, next to the field that just
  appeared. The controls physically move as you use them. The branching is
  spelled out in a nested conditional roughly 120 lines long.

**Card 2: Event details** *(metered only)*

- **Event name**: the string your code sends.
- **Event filters**: optional key / values pairs, behind another `+` chip.

**Card 3: Aggregation** *(metered only)*

- **Aggregation type**, eight options: `SUM`, `COUNT`, `COUNT_UNIQUE`,
  `SUM_WITH_MULTIPLIER`, `LATEST`, `MAX`, `WEIGHTED_SUM`, `AVG`.
- Then **either** an *Aggregation field* **or** a *Custom expression*: a toggle
  enforcing XOR by clearing whichever side is hidden. The expression is **CEL**.
  Only `SUM`, `AVG`, `MAX`, `LATEST` accept one; switching to another type
  silently drops what you wrote.
- **Multiplier**: required and must be > 0 when the type is `SUM_WITH_MULTIPLIER`.
- **Group by** and **bucket size**, behind further chips.

**Validation runs in three independent places:**

1. `validateFeature`: a Zod schema (`FEATURE_SCHEMA`).
2. `validateMeter`: a hand-written function with its own error map.
3. `isCtaDisabled`: a third `useMemo` re-deriving readiness from scratch.

Three answers to "is this ready to save", maintained separately.

### 2.3 Editing one: `FeatureDrawer.tsx`

A drawer with **six fields**: name, description, group, unit singular, unit
plural, display unit singular/plural, conversion factor.

**Type, event name, aggregation and filters are not editable.** Everything
decided on the hard screen is permanent, and nothing on that screen says so.

### 2.4 The detail page: `FeatureDetails.tsx` (558 lines)

Linked entitlements (Plan/Addon · Billing timing · Billing period · Value),
a Charges card, an "Ingest an event" action, and Alert Settings.

---

## 3. Plans

### 3.1 The list: `Plans.tsx`

Columns: Name · Status · Updated at. Row menu: Edit · Duplicate · Archive · Copy ID.

### 3.2 Creating one: `PlanDrawer.tsx`

A drawer with **four fields**: plan name, lookup key, description, metadata.

On success it navigates to the plan's detail page. **The plan now exists and
charges nothing.** Nothing in the flow says so, and nothing takes you to the
next step.

### 3.3 Adding the prices: `EntityChargesPage.tsx`

A **separate page** at `/product-catalog/plans/:planId/add-charges`, reached by
a `+ Add charge` button on a card inside the Overview tab. It is permissioned
on `price`, not `plan`: so a user can create a plan and then be refused the
ability to price it.

You first pick a pricing model: **Fixed charges** or **Usage charges**: then
fill in per-charge forms:

*Fixed* (`RecurringChargesForm`, 660 lines): amount, currency, billing period,
invoice cadence (advance / arrear), start date.

*Usage* (`UsagePricingForm`, 816 lines): feature (metered only) · display name ·
currency · billing period · **billing model** · bucket size · price · tiers ·
group · advance/arrear · start date.

Billing models: **Flat Fee · Package · Volume Tiered · Slab Tiered ·
Percentage Fee**. Volume vs Slab is the difference between "your whole usage is
priced at the tier you land in" and "each tier is priced separately": a
distinction worth real money, offered as two adjacent words with no illustration.

### 3.4 The detail page: four tabs

`Overview` · `Entitlements` · `Credit Grants` · `Information`.

Entitlements are added from **a drawer on the Entitlements tab**: the third
surface on which a plan gets configured.

### 3.5 Where a plan is configured, counted

1. `PlanDrawer`: name and key
2. `EntityChargesPage`: prices (a different page)
3. `AddEntitlementDrawer`: entitlements (a drawer on a tab)
4. `PlanCreditGrantsTab`: credit grants (another tab)

**Four containers for one object.**

---

## 4. Addons, Cost Sheets: the same machine under three names

| | Plan | Addon | Cost Sheet |
|---|---|---|---|
| Create | drawer: name, key, description | drawer: name, key, description | drawer: name, key, description |
| Prices | `EntityChargesPage` | `EntityChargesPage` | `EntityChargesPage` |
| List columns | name, status, updated | name, key, status, updated | name, key, status, updated |

All three are "a named thing with prices attached", and they literally share the
charges component. They are three nav items, three list pages, three drawers and
three detail pages.

The one real difference is **direction of money**: a cost sheet records what
usage *costs you*, so margin is visible. Nothing in the UI says that: it reads
as a third kind of plan.

---

## 5. Coupons, Price Units, Groups

**Coupons**: list: name · type · discount · redemptions · status · updated.
Drawer for create and edit. The model carries `type` (fixed | percentage),
`cadence` (once | repeated | forever), `duration_in_periods`, `currency`,
`coupon_code`, `redeem_after` / `redeem_before`, `max_redemptions`, and a free-form
`rules` object. Cadence × duration is a genuine product decision presented as two
unrelated fields.

**Price Units**: name · code · symbol · base currency · conversion rate. This is
how you bill in credits or tokens instead of dollars. It is item 6 of 7 and
means nothing until a price references it.

**Groups**: name · type (`price` | `feature`) · status. A tag over a set of
features or prices. Item 7, and meaningless until items 1 and 2 exist.

---

## 6. What actually goes wrong

Ordered by how much it costs a finance person.

1. **Creating a plan does not create a plan.** Four fields, then a plan that
   charges nothing, on a page with no next step. The money is two clicks away
   behind a button labelled `+`.

2. **The hardest screen in the product is the first one you meet.** Eight
   aggregation types, a CEL expression toggle, a multiplier, bucket size and
   group-by: before you have priced anything. Nobody can choose between `SUM`
   and `SUM_WITH_MULTIPLIER` from the descriptions given.

3. **The irreversible decision is unmarked.** Type and meter are create-only;
   edit is a six-field drawer. Get it wrong and you make a second feature.

4. **Three validators disagree.** Zod, a hand-written meter check, and a separate
   disabled-state expression. Any of the three can be right while the others are wrong.

5. **The controls move as you use them.** Opening a `+` chip replaces the chip
   row with a different chip row somewhere else.

6. **Four containers per object.** Page to create a feature, drawer to edit it;
   drawer to create a plan, page to price it, drawer to entitle it, tab to grant credit.

7. **No money is ever shown.** At no point does the catalogue say "a customer on
   this plan using 10,000 units will be billed $X". Pricing is configured blind
   and discovered on the invoice.

8. **The vocabulary is the API's.** *Lookup key · aggregation · cadence · arrear ·
   bucket size · SLAB · CEL expression.* These are wire words, shown to accountants.

9. **No ordering.** Seven sibling items with no dependency order. The correct
   first move is item 1 only by accident, and items 6 and 7 are inert until
   1 and 2 exist.

---

## 7. Directions for V2

Five options. They are not mutually exclusive: E is a prerequisite for all of
them: but A through D are genuinely different products.

### A. The Pricing Workbench: one object, one screen

One screen per plan: details, charges, entitlements and a **live bill preview**,
all visible together. Kill the separate charges page, the entitlements drawer
and the credit-grants tab.

*The claim:* the four-container problem and the no-money problem are the same
problem: configuration is spread out, so nothing can show the total.

**ReUI:** `wizard-4` (its live-invoice-preview sidebar recalculates as you edit
— the exact pattern) · `form-3` (editable line-items table with live
subtotal/tax/total) · `data-grid-expansion-3` (a charge expands into its tiers)
· `@reui/stepper` for the sections.

*Cost:* the heaviest build. *Payoff:* the only option that makes price and
outcome visible at the same time.

### B. Outcome-first: start from the bill, work backwards

The front door is not a list of entities. It is **"what should a customer pay?"**
You describe the bill; features and meters get created on demand as you name
them. The catalogue becomes a consequence of pricing rather than a prerequisite.

*The claim:* a finance person thinks in "£99/month plus £0.002 per API call",
not in "a metered feature with a SUM aggregation over an event".

**ReUI:** ReUI's pricing blocks for the preview surface · `form-3` for the
line-item builder · `wizard-1` (3 steps, per-step validation, review summary) ·
`@reui/filters` not needed here.

*Cost:* medium. *Risk:* fights the API's object model; needs care so that what
gets created is still editable afterwards.

### C. Two doors: Simple and Advanced

Accept that there are two users. **Simple** is a three-step guided flow covering
the 80% case (flat fee, per-unit, tiered). **Advanced** is today's full surface,
one click away, unchanged.

*The claim:* the current screen is not too complex for its job: it is too
complex for *most* jobs.

**ReUI:** `wizard-1` for Simple · existing forms for Advanced · a `Tabs` or
segmented control to switch · `@reui/alert` to explain what Advanced adds.

*Cost:* lowest. *Risk:* two code paths for one object, forever. Worth it only if
Simple genuinely covers most cases.

### D. Recipes: start from a named pricing pattern

The first screen is a grid of patterns: **Seat-based · Credit pack · Usage tiers
· Freemium with overage · Flat subscription · Hybrid**. Picking one pre-creates
the features, meters and prices it needs. The person edits *values*, never
structure.

*The claim:* nobody is inventing a new pricing model. They are instantiating a
known one and getting stuck on the vocabulary.

**ReUI:** a card grid for pattern selection · `form-12` (product-creation form:
status, currency-prefixed pricing, toggles, multi-select) for the edit step ·
`wizard-6` (five-step product wizard with a per-variant matrix) if patterns need
variants · `@reui/badge` for "what this recipe creates".

*Cost:* medium. *Payoff:* the highest leverage on "no need to think": the
structural decisions are pre-made and correct.

### E. Fix the information architecture (do this regardless)

Seven siblings become **three, ordered by dependency**:

| Group | Contains | The question it answers |
|---|---|---|
| **What you sell** | Plans, Addons, Coupons | What can a customer buy? |
| **What you measure** | Features (+ their meters) | What do we count? |
| **Setup** | Price Units, Groups, Cost Sheets | How do we express and organise it? |

Addons stop being a nav item and become a tab on Plans, since they are the same
object. Cost Sheets move to Setup, where their different direction of money can
be stated once.

**ReUI:** no new blocks: this is the existing `ShellNav`, already built.

---

## 8. Recommendation

**E + D, with A's preview folded in where it is cheap.**

E is close to free and removes the "where do I start" problem outright.

D attacks the real failure: the catalogue asks a finance person to make
*structural* decisions (aggregation type, billing model, tier mode) when they
only have *commercial* ones (£99 a seat, 10k calls included, then 0.2p each). A
recipe makes the structural choices and leaves the commercial ones.

A's live preview is the single highest-value element in any of these: "this
customer would be billed £X": and `wizard-4` ships it. It can be added to D's
edit step without building the whole workbench.

B is the most interesting and the most dangerous; it is worth revisiting once
the catalogue's own screens are trustworthy.

C is the fallback if there is not enough appetite for D.

# The V2 interface: research and plan

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

A clean-sheet design. **Nothing here is carried over from the current
dashboard**, including its navigation, its page structures and its form
patterns. Where V1 is mentioned it is as evidence of what to avoid.

Status: **plan, not built.** Decisions marked ⚠️ need an answer before Phase 1
starts.

---

## 1. What the research actually showed

Honest limitation first: competitor dashboards sit behind authentication, so
this is drawn from product documentation, public screenshots and changelogs:
not from using them. Where the evidence is thin I say so rather than inventing
a finding.

### The pattern everyone converged on

| | Stripe Billing | Orb | Metronome | Lago |
|---|---|---|---|---|
| Catalog shape | Product → Price | Item → Plan → Price | Product → Rate card | Billable metric → Plan → Charge |
| Metering | **Meter is a first-class object, created first** | SQL-defined metrics | Pre-aggregated metering | Billable metric object |
| Then | attach a price to the meter | attach price to item | commit/drawdown contracts | charge references metric |

The dominant model is **define the measurement, then price it**. Stripe is
explicit: *Billing → Meters → Create meter*, then create a price that selects
that meter.

**Flexprice already does this better and should keep doing it.** A Flexprice
feature carries its meter inline: `CreateFeatureRequest` takes a nested
`meter`: so one form produces both. That is one fewer object for a finance
person to understand and one fewer step to get wrong. Competitors split them
because their data model forces it, not because it is a better experience.

So: **do not copy the meter-first, two-object flow.** Keep feature-with-meter
as a single act, and make the form explain what the meter *does* in plain
language.

### What finance people are shown first

Stripe's billing analytics leads with MRR and MRR growth decomposed into new /
upgrade / downgrade / churn, then active subscribers, gross and net MRR churn,
ARPU, LTV, and cohort retention.

That decomposition is the insight worth stealing. "Revenue went up 4%" is not
actionable; "up 9% from upgrades, down 5% from churn" is. Everything else on
this page follows from one idea: **a number is only useful next to why it
moved.**

### What none of them do well

- **Nobody explains a pricing model before you pick it.** Every product offers
  a `billing_model` dropdown reading FLAT_FEE / PACKAGE / TIERED with no
  indication of what each does to a bill.
- **Nobody previews the consequence.** You configure tiers and save, and find
  out at invoice time whether you meant volume or slab.
- **Tier tables are raw grids.** No worked example, no "a customer using 5,000
  units pays $X".

Those three gaps are the opportunity. They are also exactly where V1's silent
revenue bugs live: overlapping tier bands and an unbounded final band nobody
noticed were missing.

---

## 2. Design principles

Five, in priority order. Each is testable, so a review can point at one.

**1. A finance person is the primary user, not a developer.**
No untranslated API vocabulary in the interface. `SUM_WITH_MULTIPLIER` is not a
label: "Add up a value from each event, then multiply" is. The lookup key is
shown as *Developers use this to reference the feature in code*, and it is
never the first field.

**2. Show the consequence, not just the configuration.**
Every pricing form carries a live worked example: *"A customer using 5,000
calls this month would be billed $412.50."* It recalculates as fields change.
This is the single highest-value idea in the plan: it turns an abstract form
into something checkable, and it would have caught both of V1's tier bugs at
the point of entry.

**3. Frequency decides placement.**
What is checked daily sits above what is changed monthly. The catalogue is
important and rarely edited, so it does not get top billing.

**4. Every click has a consequence the user could predict.**
No action whose effect is invisible. Destructive and customer-visible actions
name what will happen: *"Void invoice INV-1042? The customer will see this
and it cannot be undone."*: not "Are you sure?".

**5. A screen states what it does not know.**
Empty, loading and error are designed, not defaults. "No invoices match these
filters" and "No invoices yet" are different screens with different offers.

---

## 3. Information architecture

### Navigation

Ordered by how often a finance person needs it: **which is not the order it
gets built in**.

```
┌─ Environment switcher  (Sandbox / Production)         ← the most dangerous control
│
├─ Home              What needs my attention today?
├─ Customers         Who is buying, and what do they have?
│    ├─ Customers
│    ├─ Subscriptions
│    └─ Wallets & credits
├─ Billing           What are we charging, and did it get paid?
│    ├─ Invoices
│    ├─ Payments
│    └─ Credit notes
├─ Catalog           What can be sold?
│    ├─ Features
│    ├─ Plans
│    ├─ Add-ons
│    ├─ Coupons
│    ├─ Price units
│    ├─ Cost sheets
│    └─ Groups
├─ Usage             What is being measured?
│    ├─ Events
│    └─ Usage analytics
└─ Settings          Team, integrations, developers, taxes
```

Catalog is fourth in the navigation and **first to be built**, because
customers, billing and usage all reference it. Build order and navigation order
are different things and conflating them is how products end up with a menu
sorted by engineering convenience.

### Shell anatomy

Two-level: a persistent icon rail for the six sections, and a secondary panel
that **swaps to that section's sub-navigation**. Chosen because Flexprice has
six sections averaging three children: a single flat sidebar would be
twenty-plus items, and a top-nav-only shell has nowhere to put them.

```
┌──────────────────────────────────────────────────────────────┐
│ [env ▾]   breadcrumb              ⌘K search   🔔   [avatar ▾] │
├────┬─────────────────┬───────────────────────────────────────┤
│ 🏠 │  CATALOG        │                                       │
│ 👥 │  ─────────      │   page content, max-width 1440        │
│ 🧾 │  Features    12 │                                       │
│ 📦 │  Plans        5 │                                       │
│ 📊 │  Add-ons      3 │                                       │
│ ⚙️  │  Coupons      0 │                                       │
│    │  Price units    │                                       │
└────┴─────────────────┴───────────────────────────────────────┘
```

Counts in the secondary nav are deliberate: they answer "is there anything
here?" before a click, which is how an empty catalogue becomes obvious rather
than a surprise.

### ⚠️ The environment switcher

The most consequential control in the product, and in V1 it is a quiet
dropdown. Two decisions needed:

- **Does Production look different?** Recommendation: yes: a coloured top
  border and the environment name always visible. Editing a live plan should
  not look identical to editing a sandbox one.
- **Does switching environments preserve the current page?** Recommendation:
  yes where the entity exists in both, otherwise land on that section's list.
  Silently redirecting Home is disorienting.

---

## 4. Phase 1: foundation

Nothing sellable ships in Phase 1. It exists so Phase 2 has somewhere to live.

### 1.1 Authentication

Three screens. Split-screen layout, form on the left, product proof on the
right.

| Screen | Contains |
|---|---|
| **Sign in** | Email, password with show/hide, "Forgot password", SSO buttons, error region above the form |
| **Forgot / reset** | Single email field → confirmation state on the same screen, no navigation |
| **Accept invitation** | Set a password, shows which organisation and which role is being joined |

**No sign-up screen.** `POST /v1/auth/signup` provisions an entire new tenant:
a user joining an existing organisation is created by an admin. Shipping a
public sign-up in an internal console invites someone to create a second empty
tenant by accident. ⚠️ Confirm this is the intent.

Interaction detail that matters: a failed sign-in keeps the email, clears only
the password, focuses the password field, and shows one sentence: *"That email
and password do not match."* Never "Invalid credentials", which reads as a
system error rather than a typo.

**Blocked on backend:** `auth.go` is 0 of 2 annotated, `environment.go` 1 of 5.
Phase 1 can be built against the mock corpus and wired when those land.

### 1.2 App shell

- Icon rail, secondary nav panel, header with environment switcher, breadcrumb,
  ⌘K search, notifications, account menu
- Light/dark, respecting system preference
- Responsive: the rail collapses below `lg`, the secondary panel becomes a sheet
- Route-level code splitting from the start: the bundle is already 1.25 MB

### 1.3 The page skeleton every screen uses

One layout, so no screen invents its own:

```
PageHeader     title · subtitle · primary action · overflow menu
PageToolbar    search · filters · saved views          (list pages only)
PageBody       content
PageFooter     pagination                              (list pages only)
```

### 1.4 The five states, designed once

Loading (skeleton matching final layout, never a spinner on a full page),
empty-no-data, empty-no-results, error-retryable, error-permission. Each is a
story before any screen uses it.

---

## 5. Phase 2: the catalogue

Build order within the phase, chosen by dependency:

```
Features ──▶ Plans ──▶ Add-ons ──▶ Coupons
   │           │
   └── Price units, Groups, Cost sheets (independent)
```

Features first: a plan's charges reference features, so nothing else can be
demonstrated end to end without them.

### 5.1 Feature creation: the reference design

Written in full because every other catalogue form follows its shape.

#### The problem

V1's `AddFeature.tsx` is **1,106 lines with four state slices**, presents
`SUM_WITH_MULTIPLIER` as a bare dropdown value, and accepts a zero multiplier
that silently bills nothing.

#### Route

`/catalog/features/new`: a page, not a modal. Two conceptual domains
(identity, and measurement), and it needs room for an explanation and a preview.

#### ⚠️ Step 0: choose the type: a decision, not a dropdown

Four cards, each with a plain description and a concrete example. This is the
choice that determines everything downstream, so it gets a screen's worth of
weight rather than a `<select>`:

| Card | Body | Example shown |
|---|---|---|
| **Metered** | Charge for how much they use. Measured from events you send. | *API calls, tokens, minutes of video* |
| **Switch** | On or off for a plan. Either included or not. | *SSO, priority support* |
| **Quantity** | A fixed number included in the plan. | *10 seats, 5 projects* |
| **Configuration** | A value the plan carries, not billed directly. | *Data retention: 90 days* |

Deliberately not the API's words. "Boolean", "Static" and "Config" mean
nothing to a finance person; `type` is still `boolean`/`static`/`config` on the
wire.

Choosing a card advances immediately: no Next button. The choice is
re-editable from the form via a "Change type" link that warns it clears the
form, because it does.

#### The form

Two columns: form left, **live preview right**.

**Section 1: What is it?**

| Field | Notes |
|---|---|
| Name | Required. Autofocused. Placeholder *"API calls"* |
| Description | Optional, one line of help |
| Unit (singular / plural) | Side by side. Derived from the name with an override. Shown as *"Displayed on invoices as '1,200 calls'"* |
| Lookup key | **Collapsed under "Developer settings"**, auto-generated from the name, editable. Not the third thing a finance user sees. |

**Section 2: How is it measured?** *(metered only)*

| Field | Notes |
|---|---|
| Event name | Required. Help: *"The name your application sends when this happens."* |
| What to count | Radio cards, not a dropdown: see below |
| Event property | Only when the choice needs one. Help names the JSON property. |
| Multiplier | Only for the multiplied option. **Rejects 0**: the live V1 defect. |
| Reset | *"Every billing period"* / *"Never: counts forever"* |

**"What to count" in plain language**, with the API value alongside:

| Shown | API |
|---|---|
| Count how many times it happens | `COUNT` |
| Count unique values | `COUNT_UNIQUE` |
| Add up a value from each event | `SUM` |
| Add up a value, then multiply | `SUM_WITH_MULTIPLIER` |
| Average a value | `AVG` |
| Highest value seen | `MAX` |
| Most recent value | `LATEST` |
| Weighted total | `WEIGHTED_SUM` |

Only the first four are shown initially; the rest sit behind "More options".
Eight equal radio cards is a wall.

#### The live preview: the part that makes this design

Right column, updating as fields change:

```
┌─ Preview ───────────────────────────────────┐
│  API calls                        [Metered] │
│                                             │
│  Measured from   api_call                   │
│  Counted as      how many times it happens  │
│  Resets          every billing period       │
│                                             │
│  On an invoice this reads:                  │
│    API calls            1,200 calls         │
│                                             │
│  Your application sends:                    │
│    { "event_name": "api_call",              │
│      "external_customer_id": "cus_123" }    │
└─────────────────────────────────────────────┘
```

The event payload is the bridge between the finance person configuring it and
the engineer who has to send it: and it makes a misnamed event obvious before
it is saved rather than after nothing arrives.

#### Validation

On blur, never on keystroke. Errors sit under the field and are announced.
Submit focuses the first invalid field. Rules come from the domain schema, so
the message a person reads is the rule an agent is held to: already built and
tested.

#### Success

Redirect to the feature's detail page with a toast: *"API calls created."* Not
back to the list: the next thing someone wants is to see what they made, and
often to add it to a plan. The detail page carries that as a primary action.

### 5.2 Plans

**List**: name, charge count, currency spread, subscriber count, status.
Subscriber count is the column people actually scan for.

**Create**: a **stepper**, because it genuinely sequences and spans domains:

```
1 Details      name, key, description
2 Charges      recurring fee + usage charges referencing features
3 Entitlements what the plan includes
4 Credits      recurring or one-off grants
5 Review       everything, with a worked monthly example
```

Step 5 is the point. *"A customer on this plan using 5,000 API calls would be
invoiced $249 base + $62.50 usage = $311.50."* A plan is a pricing decision and
nobody should commit to one without seeing it priced.

⚠️ Steps 3 and 4 are blocked: the captured environment has no plan entitlements
or credit grants, so neither can be built against real data yet.

#### Charges: where the pricing models get explained

Each charge picks a feature, then a model, as **cards with a worked example**:

| Model | Explained as | Example |
|---|---|---|
| Flat fee | The same price for every unit | *$0.01 per call. 5,000 calls = $50.* |
| Package | A price per block of units | *$10 per 1,000 calls. 5,000 = $50.* |
| Tiered: volume | One rate for everything, set by the total | *5,000 falls in the 1k–10k band at $0.008, so all 5,000 are $0.008 = $40.* |
| Tiered: slab | Each band charged at its own rate | *First 1,000 at $0.01, next 4,000 at $0.008 = $42.* |

**Volume vs slab is the single most misunderstood concept in usage billing**,
and every competitor ships it as two words in a dropdown. Showing both
computed against the same quantity is the clearest way to make the difference
land.

The tier editor: an always-present unbounded final row that cannot be deleted,
ascending validation on blur, and a running example under the table. Both of
V1's silent revenue bugs become impossible to express.

### 5.3 Add-ons, coupons, price units, cost sheets, groups

Same shapes, less detail needed:

- **Add-ons**: like a plan with charges, no entitlement/credit steps. Single
  page, not a stepper.
- **Coupons**: single page. The interesting UX is the *rule* summary:
  *"20% off the first 3 invoices, up to $500, expires 31 Dec."* built from the
  fields as they are set.
- **Price units**: small form. Currency, symbol, conversion rate.
- **Cost sheets**: ⚠️ I do not understand the product intent well enough to
  design this. Needs a walkthrough.
- **Groups**: small form; the value is in how groups are *used* elsewhere.

---

## 6. ReUI blocks

Surface locked to **Card** throughout. Free components need no licence; blocks
need the Pro key already configured.

| Need | Block | Note |
|---|---|---|
| App shell | `app-shell-16` | Dual sidebar, secondary nav **swaps per section**, workspace switcher → environment switcher. Card surface. |
| Sign in | `auth-18` | Split screen, password show/hide, SSO |
| Plan create | `wizard` category (7) | Over the existing `WorkflowStepper` |
| All lists | `data-grid` (37 blocks) | `data-grid-filtering-1` for the toolbar pattern |
| Home | `stats` (15), `chart` (30) | MRR decomposition |
| Empty states | `empty-state` (14) | |
| Forms | `form` (12) | Over the existing `Field` |
| Confirmations | `dialog` (14) | Sensitive actions only |

Existing foundation already covers `Field`, `Section`, `EmptyState`, `Toolbar`,
`WorkflowStepper`, `Money`, `Metric`, `UsageMeter`, `InvoiceStatusBadge`,
`InvoiceGrid`, `FeatureGrid`, `FeatureForm`, `PriceOverrideForm`.

**Note:** `app-shell-16` differs from Watchtower's `app-shell-12`. Deliberate:
different product, different IA depth: but worth a conscious sign-off.

---

## 7. What I need decided

| # | Decision | My recommendation |
|---|---|---|
| 1 | Navigation order above | As listed: frequency, not entity count |
| 2 | Production visually distinct? | Yes. Coloured border + persistent label |
| 3 | Ship a sign-up screen? | **No**: signup provisions a whole tenant |
| 4 | Type chooser as step 0 | Yes: it is the decision that shapes the form |
| 5 | Plain-language aggregation labels | Yes, with the API value alongside |
| 6 | Live preview / worked example | **Yes: the highest-value idea here** |
| 7 | `app-shell-16` over `app-shell-12` | Yes |
| 8 | Cost sheets | Needs a product walkthrough before design |
| 9 | Plan steps 3–4 | Build the shell, leave empty, until data exists |

---

## 8. Honest gaps

- **Competitor UX was inferred from documentation**, not from using the
  products. The IA comparison is solid; claims about interaction detail are
  weaker and I have avoided making them.
- **Cost sheets and groups**: I can describe the forms, not argue the product
  design, because I do not understand what they are for.
- **No visual design.** This is structure, behaviour and copy. Colour,
  typography and spacing come from the ReUI tokens already chosen.
- **Home** is sketched, not specified. It depends on which numbers finance
  actually wants first, which is a conversation, not a guess.

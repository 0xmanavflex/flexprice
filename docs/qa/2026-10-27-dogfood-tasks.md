# Dogfood review, 2026-10-27: task list

Fixes from the 2026-10-27 dogfood walkthrough of the console (customer → feature → plan → contract →
add-ons → wallet → activity → alerts → hosted invoice → reports → onboarding). One PR per task to
`develop`, following `AGENTS.md` and `docs/design-rules.md`.

Left out on purpose: the lookup-key mix-up (user error, confirmed in the session), the config-feature
JSON on entitlements (already built), and the reports and usage questions that were only "ask him".

**Status:** Open · In progress · In review (PR open) · Done (merged) · Blocked (reason given)
**Priority:** P1 wrong behaviour or missing data · P2 a flow is incomplete · P3 polish

## Customer

### D-01 Address fields are dropdowns everywhere (P2)
- **Problem.** City and state are free text. Country is a dropdown in most places but not all.
- **Scope.** Every address form: customer create and edit, checkout, customer portal, and any other
  place that takes an address.
- **Acceptance.**
  - Country, state and city are dropdowns.
  - State depends on the country, and city on the state.
  - Postal code stays a typed field.
  - One shared address part is used everywhere, with no per-page copies.
- **Where.** `packages/ui/src/pages/customers/CustomerForm.tsx`, plus a new shared address
  composition.
- **Open question.** Where the state and city lists come from (a bundled dataset or an API).
- **Status.** Open.

### D-02 Billing configuration while creating a customer (P2)
- **Problem.** Billing settings, including taxable, can only be set after the customer exists.
- **Acceptance.**
  - Customer create has a billing configuration step or section with the same fields as edit,
    including taxable.
  - The values are saved on create.
- **Where.** `CustomerForm.tsx`, `apps/console/src/pages/customers/CustomerFormPage.tsx`.
- **Status.** Open.

## Features and meters

### D-03 Custom expression: expand only, with a faint placeholder (P3)
- **Acceptance.**
  - Ticking "Use a custom expression" only expands the field.
  - The field shows a faint placeholder expression, for example a duration divided by minutes and
    by 100.
  - There is no examples block above the field.
- **Where.** `packages/ui/src/pages/product-catalog/products/FeatureForm.tsx` (~559-581).
- **Status.** Open.

### D-04 Placeholders on aggregation inputs (P3)
- **Acceptance.**
  - Event field, multiplier (a number input) and group by show a faint example placeholder where
    the label alone is not enough.
  - Count has no fields.
  - Count unique, latest, max and sum-with-multiplier keep the fields they already have.
- **Where.** `FeatureForm.tsx`.
- **Status.** Open.

## Dates

### D-05 Selected day is darker (P3)
- **Acceptance.** The selected day in the shared calendar is clearly darker than today and hover
  (tokens only).
- **Where.** The shared calendar / date input composition.
- **Status.** Open.

### D-06 Date fields carry time and timezone (P2)
- **Acceptance.**
  - Date fields that set a moment (contract start, charge start and end, grant dates) take a time.
  - They show the timezone (UTC unless the tenant has one).
  - Every changed field sends an instant.
- **Open question.** Which fields need time and which are calendar days only (for example the
  analytics range).
- **Status.** Open.

### D-07 No native browser calendars (P2)
- **Problem.** These use `type="date"`, which opens the browser's own picker:
  - charge edit, `packages/ui/src/pages/contracts/ContractChargeDialog.tsx:260`;
  - `ContractQuantityDialog.tsx:221`;
  - `CustomerAnalyticsView.tsx:145`.
- **Acceptance.**
  - Every date input uses the shared calendar.
  - `git grep 'type="date"' packages/ui/src` returns nothing.
- **Status.** Open.

## Contract creation

### D-08 Charges table fits without scrolling (P2)
- **Acceptance.**
  - Equal column padding.
  - No horizontal scroll at the wizard's width.
  - Only the columns that are needed.
  - Quantity, billing timing and in effect line up with the other columns.
  - No column wraps onto two lines.
- **Where.** `packages/ui/src/pages/contracts/SubscriptionForm.tsx` (charges table).
- **Status.** Open.

### D-09 A charge outside the contract start is a note, not a column (P3)
- **Acceptance.**
  - When a plan charge falls outside the contract's start date, no extra column appears.
  - A short info note says one charge sits outside the contract start.
- **Where.** `SubscriptionForm.tsx` ("In effect" handling).
- **Status.** Open.

### D-10 Add-ons expand into all their charges, editable before adding (P1)
- **Problem.**
  - An add-on with a fixed and a usage charge shows only one charge in the contract flow.
  - Prices cannot be changed before the add-on is added.
- **Acceptance.**
  - Selecting an add-on shows a table of all its charges, both fixed and usage.
  - Each line's price can be overridden before adding (`override_line_items`).
  - The overrides are sent on create and on add-to-contract.
- **Where.** `SubscriptionForm.tsx` (add-ons), the contract detail Add add-on dialog, and
  `packages/domain/src/contractCharges.ts` (`attachableAddonCharges`).
- **Note.** This replaces R-14 in `2026-10-26-review-tasks.md`.
- **Status.** Open.

### D-11 Entitlements are editable in the contract flow (P2)
- **Problem.** Metered and static entitlements on a new contract are read-only.
- **Acceptance.** They can be edited the same way as in the entitlement form, including the value
  type (quantity or amount).
- **Where.** `SubscriptionForm.tsx`, reusing the plan entitlement form fields
  (`GrantAllowanceFields`).
- **Status.** Open.

### D-12 Add-on edit: finish it, fix spacing and the rule line (P3)
- **Acceptance.**
  - An added add-on can be edited.
  - The add-ons table has the section's standard spacing.
  - No divider line runs into the table.
- **Where.** `SubscriptionForm.tsx` (add-ons section).
- **Status.** Open.

### D-13 Check the FX override when billing and plan currency differ (P2, verify first)
- **Acceptance.**
  - When the customer's billing currency differs from the plan's, the contract flow offers the FX
    override and sends it.
  - If it already does, record that here with the steps used to check.
- **Status.** Open (verify).

## Contract page

### D-14 Upcoming invoice: amount, subtotal, right-aligned numbers (P2)
- **Acceptance.**
  - The upcoming invoice table has an Amount column and a Subtotal row.
  - Every number column is right-aligned on one edge.
- **Where.** `packages/ui/src/pages/contracts/SubscriptionDetailView.tsx` (upcoming invoice).
- **Status.** Open.

### D-15 Unlimited entitlements say "unlimited" once (P3)
- **Acceptance.**
  - A limited entitlement reads "0 of 30" with a bar.
  - An unlimited one reads "N of unlimited" once, with no second "Unlimited" under the bar.
- **Where.** `packages/ui/src/pages/shared/EntitlementUsage.tsx` (~137).
- **Status.** Open.

### D-16 Sections with rows come first (P3)
- **Acceptance.**
  - Upcoming invoice stays at the top while there is one, and is hidden when there is none.
  - Below it, sections that have rows come first.
  - Empty sections that are only an entry point for adding something sit lower.
- **Open question.** The session agreed to hide upcoming invoice when there is none, while the
  summary says it always stays at the top. Confirm which.
- **Where.** `SubscriptionDetailView.tsx`.
- **Status.** Open.

### D-17 A contract with charges shows them (P1)
- **Problem.** The charges block is empty on a contract whose subscription has two charges.
- **Acceptance.**
  - Every charge on the subscription shows on the contract page.
  - The cause is found, whether mapping, a filter or the API, and covered by a test.
- **Where.** `SubscriptionDetailView.tsx`, `packages/query/src/subscriptions.ts`.
- **Status.** Open.

### D-18 One feature after a price change, not two (P2, verify first)
- **Problem.** After a price change, one feature with two subscription line items shows as two
  features on the customer's usage.
- **Acceptance.**
  - Usage by feature groups line items by feature.
  - Each price's revenue still shows, inside the feature's row or a breakdown.
- **Where.** Customer usage / analytics (`CustomerAnalyticsView.tsx` and its panel).
- **Status.** Open (verify).

## Credit grants and coupons

### D-19 Credit grant form: note last, recurring options above it (P3)
- **Acceptance.**
  - The long explanatory note is the last block in the form, full width.
  - Recurring options ("refreshes every…") open above the note, not beside it.
- **Where.** `packages/ui/src/pages/product-catalog/credit-grants/CreditGrantForm.tsx`.
- **Status.** Open.

### D-20 Coupon create: space between details and metadata (P3)
- **Acceptance.** The coupon form has the standard section gap between details and metadata.
- **Where.** `packages/ui/src/pages/settings/discounts/CouponForm.tsx`.
- **Status.** Open.

## Wallet and activity

### D-21 Wallet summary titles come back (P2)
- **Acceptance.**
  - The wallet summary names each figure again, telling the ongoing credits apart from the total.
  - It uses the names the summary used before.
- **Where.** `packages/ui/src/pages/customers/CustomerWalletView.tsx`. Check git history for the
  previous labels.
- **Status.** Open.

### D-22 Activity table: columns and the standard filters (P2)
- **Acceptance.**
  - The Status column is gone.
  - Actor and time stay.
  - Source (API, dashboard, workflow) has its own column.
  - Column spacing matches other tables.
  - The All actions, All actors and All sources selects are replaced by the usual table filter
    and sort.
  - The time range (24 hours, 7 days, 30 days, custom) stays.
- **Where.** `packages/ui/src/pages/customers/CustomerActivityView.tsx`,
  `apps/console/src/pages/customers/CustomerActivityPanel.tsx` and `activitySearch.ts`.
- **Note.** Keep the Person filter (#222) inside the new filter.
- **Status.** Open.

## Alerts, hosted invoice, plans

### D-23 Alert settings: separate the levels, match heights (P3)
- **Acceptance.**
  - A dotted divider and spacing separate info, warning and critical.
  - The unit select (percentage or absolute) is the same height as the amount input beside it.
  - Find out why part of the form does not load.
- **Where.** `packages/ui/src/pages/shared/EntityAlertDialog.tsx`, `ChargeAlertForm.tsx`,
  `apps/console/src/pages/settings/WalletAlertsPanel.tsx`.
- **Status.** Open.

### D-24 Hosted invoice: gray page and a disabled Pay with tooltip (P2)
- **Acceptance.**
  - The page background is light gray (a token), with the invoice card on top.
  - When online payment is unavailable, Pay is disabled.
  - Hovering Pay shows a tooltip saying to contact the merchant, with their email as a link.
  - The long inline copy goes.
- **Where.** `packages/ui/src/pages/billing/hosted-invoice/HostedInvoiceView.tsx` (~265).
- **Status.** Open.

### D-25 Usage-only plans: no blank flat price (P2)
- **Acceptance.**
  - A plan with only usage charges does not show an empty flat price or "plus usage".
  - It names the usage feature the way a customer would read it, for example "Usage-based · API
    calls".
- **Where.** Plans list and plan cards / plan detail header.
- **Status.** Open.

## Onboarding

### D-26 Reviews order and logos (P3)
- **Acceptance.**
  - Reviews read in this order: Cali Collins, Ram A (Wapi), Martin (CNB), Justin Benson, then
    SimplySmart, then Truffle AI.
  - The Wapi and Facilio logos are smaller and left-aligned.
  - The grid sits at eye level.
  - The form stays as in the artifact, with reviews on the right.
- **Where.** `packages/ui/src/pages/auth/testimonials.ts` and the sign-in / onboarding layout.
- **Status.** Open.

## Sync

### D-27 Notify when a contract sync finishes (P2)
- **Acceptance.**
  - When a contract sync completes, a toast says it is done.
  - When a sync fails, the toast says it failed.
- **Open question.** Whether the API reports completion synchronously or needs polling or a
  webhook.
- **Status.** Open.

## Reports

### D-28 Reports pass after the latest reports change (P1)
- **Problem.**
  - Credit consumed and credit topped up are two tables stacked without separation.
  - Top 10 customers draws a chart at 0 instead of an empty state.
  - Revenue is missing its inner table.
- **Acceptance.**
  - The two credit tables are presented as separate, titled sections.
  - A chart with no data shows the empty state.
  - Revenue shows its table again.
  - The last 12 months shows data where data exists.
- **Where.** `apps/console/src/pages/revenue/ReportsPage.tsx`,
  `packages/ui/src/pages/revenue/RevenueReport.tsx`.
- **Status.** Open.

## Progress

| Task | PR | Status |
|---|---|---|
| Task list | this PR | In review |

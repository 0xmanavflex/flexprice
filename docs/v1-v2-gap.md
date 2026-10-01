# V1 → V2: what is missing, and what it takes to finish

A route-by-route and operation-by-operation comparison of `flexprice-front` (V1)
against `flexprice-console` (V2), done by reading both routers, both API layers
and the SDK rather than by clicking around.

## The headline

**V2 is a complete read surface with a complete catalogue. The billing
lifecycle is read-only.**

Every destination in the navigation is a real page — the placeholder table is
down to one row (`/docs`). Features, plans, add-ons, coupons, cost sheets,
price units, groups, customers and tax rates can be created, edited and
deleted. Lists, filters, detail pages and settings are in better shape than
V1's.

But nothing in the money path can be *changed*. You cannot create a
subscription, finalize an invoice, record a payment, top up a wallet or issue a
credit note. Those screens render; their buttons do not act.

The gap is **28 write operations**, not 28 screens:

| Domain | Write ops in the SDK | Bound in V2 |
| --- | --- | --- |
| Subscriptions | 10 | 0 |
| Invoices | 6 | 0 |
| Wallets | 4 | 0 |
| Payments | 3 | 0 |
| Tax associations | 3 | 0 |
| Credit notes | 2 | 0 |
| **Total** | **28** | **0** |

Every one of them exists in `@flexprice/sdk@2.1.30` today —
`subscriptions-create-subscription`, `invoices-finalize-invoice`,
`wallets-top-up-wallet`, `payments-create-payment`,
`credit-notes-create-credit-note`, `tax-associations-create-tax-association`.
This is the pattern we have hit five times already on this project: **a missing
binding is not a missing capability.** None of this needs backend work.

## Tier 1 — blocks going live

These are the reasons V2 cannot replace V1 for a real operator.

### Subscription creation does not exist

`/subscriptions/new` renders a six-step stepper in which **five steps have no
form**. The file says so itself: *"Five of the six steps have no form yet."*
The one implemented step (Prices) runs against a hard-coded `priceId="price_01"`,
holds its state in local component state, and there is no
`useCreateSubscription` hook anywhere in `@fp/query`.

The scaffolding is good — URL-driven steps, deep-linkable, back button works,
the contextual `CustomerSubscriptionCreate` variant already exists. It is the
five forms and the mutation that are absent.

Needed: Customer, Plan, Entitlements, Credits and Review steps; a
`useCreateSubscription` binding; then `cancel`, `pause`/`resume`, addon
attach/detach and line-item edit.

### Invoice actions are stubs

`InvoiceDetailView` takes `onFinalize` and `onRetryPayment` props. The page
passes `toast('Finalize is not wired yet')` and
`toast('Retry payment is not wired yet')`.

Needed: bind `invoices-create-invoice`, `finalize-invoice`, `void-invoice`,
`update-invoice`, `update-invoice-payment-status`, `attempt-invoice-payment`.
V1 also has a create-invoice-for-a-customer flow
(`/billing/customers/:customerId/invoices/create`) with no V2 equivalent.

### Credit notes, payments, wallets are list-only

- **Credit notes**: a list, no detail page, no create. V1 issues them from an
  invoice (`invoice/:id/credit-note`).
- **Payments**: a list, no detail, no record-payment.
- **Wallets**: a customer tab, no top-up, no terminate, no auto-top-up config.

### Tax associations are absent entirely

Zero components, zero hooks. V1 has a customer tax-association tab. The three
SDK operations are unbound. (Tax *rates* are fully built — it is the
association between a rate and a customer that is missing.)

## Tier 2 — detail and edit pages that do not exist

| Surface | V1 | V2 |
| --- | --- | --- |
| Subscription detail | yes | **no route** |
| Subscription edit | yes | **no route** |
| Credit note detail | yes | no |
| Payment detail | yes | no |
| Tax rate detail | yes | edit only, no detail |
| Add-on / coupon / cost sheet / price unit / group **edit** | yes | create + detail only |
| Invoice edit | yes | no |
| Add charges (plan / add-on / cost sheet) | 3 routes | not as routes |
| Workflow run detail | yes | no |
| Integration detail | yes | no |
| S3 export management / runs | 3 routes | no |

Customer detail tabs — V2 has overview, subscriptions, invoices, wallet, usage,
events, information. V1 additionally has **credit notes**, **tax association**
and **analytics**.

## Tier 3 — whole areas with no V2 counterpart

- **Onboarding** (`/onboarding`, `/onboarding/pricing-setup`) — V1 gates new
  tenants through it; V2 drops you straight into an empty console.
- **SAML SSO settings** — V1 has a panel; V2's 19 settings panels do not
  include one.
- **Customer portal** (`/customer-portal`) and **checkout** (`/checkout`) —
  public, customer-facing surfaces.
- **Query page** (`/usage-tracking/query`) — ad-hoc usage querying.
- **Bulk imports** (`/tools/bulk-imports`).
- **Meters** — V1 has create/edit meter screens. V2 has no meters domain at all
  (the `*Meter*` files are chart components). Per `forms-and-editing.md` this is
  deliberate: meters are created through a feature and immutable after.
- **Auth**: V2 has sign-in, forgot-password and accept-invitation. V1 also has
  signup confirmation, resend verification, verify email and the SAML callback.

## The interaction model is already decided

Worth stating plainly, because it is easy to re-litigate: `docs/forms-and-editing.md`
already specifies exactly the model we want — inline edit for simple values,
full-page `FormPage` for creation, full-page stepper (`useFormSteps`) for long
journeys, the same form for edit, and `ContextualSection` for nested creation
inside a detail page.

The problem is **coverage, not design**:

| Pattern | Built | Used by |
| --- | --- | --- |
| `FormPage` | yes | 11 forms |
| `useFormSteps` stepper | yes | 3 (Customer, Feature, Plan) |
| `ContextualSection` | yes | 1 (CustomerDetail) |
| `InlineField` | yes | via `EditableCard` only |

So the components exist and are proven. Finishing the migration means applying
them to the remaining entities — not designing anything new.

## Order of work

1. **Subscription create** — five step forms plus `useCreateSubscription`.
   Unblocks the single most important flow and exercises the stepper properly.
2. **Invoice lifecycle** — finalize, void, update, retry payment, create. Six
   bindings behind buttons that already exist.
3. **Subscription detail + edit** — the detail route is missing entirely, and
   cancel/pause/resume hang off it.
4. **Payments and credit notes** — record a payment, issue a credit note from
   an invoice, plus the two detail pages.
5. **Wallet operations** — top up, terminate, auto-top-up.
6. **Tax associations** — three bindings and a customer tab.
7. **Edit routes for the remaining catalogue entities** — add-on, coupon, cost
   sheet, price unit. (Groups have no update route in the API; create/delete
   only.)
8. **Charges as routed pages** — plan, add-on and cost sheet charge editors.
9. **Tier 3 areas** — onboarding, SAML, query page, bulk imports, portal.

Items 1–7 are all client-side bindings over operations that already exist. No
backend change is required for any of them.

## Method

- V1 routes: `src/core/routes/Routes.tsx` (`RouteNames`, 702 lines).
- V2 routes: `apps/console/src/app/router.tsx` and `placeholderRoutes.ts`.
- V2 mutations: 51 `use(Create|Update|Delete|Archive)*` hooks in `@fp/query`.
- SDK: 267 operations in `@flexprice/sdk@2.1.30`, 131 of them writes.

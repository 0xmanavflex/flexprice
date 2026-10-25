# V1 → V2: what is missing, and what it takes to finish

A route-by-route and operation-by-operation comparison of `flexprice-front` (V1)
against `flexprice-console` (V2), measured by reading both routers, both API
layers and the SDK.

**Status: 2026-10-01.** This file moves fast: most of what it listed as missing
on the morning of the 1st was bound by that afternoon. Re-measure before
trusting it (the commands are at the bottom). For what is *deliberately* not
built, and which SDK modules remain unbound by choice, see
[`v2-capability-gaps.md`](./v2-capability-gaps.md): that file is the decisions,
this one is the comparison.

## Where it stands

V2 reads everything V1 reads, its catalogue is complete, and the billing
lifecycle is now mostly writable. Every navigation destination is a real page;
`/docs` is the only placeholder route left.

Of the 23 billing-lifecycle write operations the SDK exposes, **16 are bound**:

| Domain | Bound | Not yet |
| --- | --- | --- |
| Subscriptions | create, cancel, activate | update, add-addon, line items |
| Invoices | create, finalize, void, attempt-payment | update, update-payment-status |
| Wallets | create, top-up, terminate | update |
| Payments | create, delete | update (deliberate: see the decisions doc) |
| Credit notes | create, void |: |
| Tax associations | create, update, delete |: |

The seven that remain are all edit-after-the-fact operations. None of them
blocks an operator from running the billing cycle end to end, which the bound
sixteen now cover.

Every one of them exists in `@flexprice/sdk@2.1.30` already. The recurring
lesson on this project holds: **a missing binding is not a missing capability.**
No backend work has been needed for any of this.

## Routes that still have no V2 equivalent

| Surface | V1 | V2 |
| --- | --- | --- |
| Subscription edit | `/subscriptions/:id/edit` |: |
| Invoice edit | `/invoices/:id/edit` |: |
| Tax rate detail | yes | edit only |
| Price unit edit | yes |: |
| Group edit | yes | API has no update route; create/delete only |
| Add charges (plan / add-on / cost sheet) | 3 routes | editors exist, not as routes |
| Workflow run detail | `/workflows/:id/:runId` |: |
| Integration detail | yes |: |
| S3 export management and runs | 3 routes |: |

Customer detail tabs: V2 has overview, subscriptions, invoices, wallet, usage,
events, information. V1 additionally had an **analytics** tab.

## Areas with no V2 counterpart

Each is now a recorded decision rather than an oversight: see the decisions
doc for the reasoning:

- **Bulk imports**: blocked on an upload mechanism that produces the `uploadId`
  `tasks.createTask` requires. Nothing in the SDK or the console produces one.
- **Checkout**: customer-facing, not an operator screen.
- **Customer portal, onboarding, SAML SSO, query**: covered by Settings panels
  and the usage views rather than by new surfaces.
- **Meters**: created through a feature and immutable afterwards, per
  `forms-and-editing.md`. V1's meter screens have no V2 equivalent by design.
- **Auth**: V2 has sign-in, forgot-password and accept-invitation. V1 also had
  signup confirmation, resend verification, verify email and the SAML callback.

## The interaction model is settled

`docs/forms-and-editing.md` already specifies it: inline edit for simple values,
`FormPage` for creation, a full-page stepper (`useFormSteps`) for long journeys,
the same form for edit, and `ContextualSection` for nested creation inside a
detail page. The components exist and are proven.

What remains is applying them to the entities that still use something else:
coverage, not design.

## Re-measuring

```sh
# Routes
grep -oE "path: '/[^']*'" apps/console/src/app/router.tsx | sort -u

# Which SDK write ops are bound
grep -rl '\.createSubscription(' packages/api/src packages/query/src

# Mutation hooks
grep -rhoE 'export function use(Create|Update|Delete|Cancel|Void|Finalize|TopUp|Terminate|Activate)\w+' \
  packages/query/src/*.ts | sort

# SDK operations available
ls node_modules/.pnpm/@flexprice+sdk@*/node_modules/@flexprice/sdk/esm/funcs/*.js
```

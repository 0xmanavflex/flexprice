# V2 capability gaps and deliberate omissions

What the admin console does not do, and why. Each entry is either a decision
(leave it out) or a gap with the condition under which it should be built.

## Bulk imports: gap, not built

The SDK exposes `tasks` (list, get, create, process). `createTask` needs an
`uploadId` for a file that already exists in storage, and V2 has no upload
mechanism: nothing in the SDK or the console produces that id. An "Import"
button would therefore open a flow that cannot finish.

- Not built: no import entry point, no placeholder that implies one.
- Build when: an upload mechanism is defined. Until then a read-only task list
  (`tasks.listTasks` / `getTask`) is possible, but only if import *monitoring*
  is explicitly wanted; `ExportListPage` / `dataExports.ts` is the template.

## Checkout: out of admin V2

`checkout` is the customer-facing payment-provider flow (hosted session for a
customer paying). It is not an operator screen, and inventing an admin surface
for it would misrepresent what it does. Revisit only if a customer-facing
product is added to this repo.

## Customer portal, onboarding, query, SAML SSO: no new UI

Intended V2 surfaces already exist (Settings panels for portal and onboarding;
the query/usage views). SAML SSO shows an unavailable state when the backend
returns 404 and is intentionally not hidden.

## Remaining audit (SDK bound vs unbound)

Unbound SDK modules after this pass: `alerts`, `environments`, `marketplace`,
`refunds`, `webhookEvents`, `usageRecords`, `checkout` (above), `customerPortal`
(admin config only; see above), `tasks` (above). Binding any of them means
adding a query slice first, then a surface; none has a V2 route today.

Navigation: `/docs` is the only placeholder route left
(`apps/console/src/app/placeholderRoutes.ts`).

Standing deviations: `InvoiceCreatorBlock` is replaced by `InvoiceForm`; payment
update is intentionally not exposed; wallet stubs were dropped.

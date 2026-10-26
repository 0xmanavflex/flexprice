# Review task list (2026-10-26)

Built from the full review checklist (status chips, contracts, charges, catalogue, credits and wallets,
customer portal, hosted invoices, activity, analytics, events, exports and integrations, settings,
general UI) and the walkthrough transcript, then audited against `develop` @ 468bcd43 and the backend
(`flexprice` `upstream/develop`). Each item says what is already true, with evidence, so finished work is
not redone.

**Workflow.** One focused PR per task, against `develop`. Merging: the session's permission check
refuses `gh pr merge` ("Merge Without Review"), so PRs are opened and left for a person to merge. That
is recorded per task rather than worked around.

Status: `Pending`, `In Progress`, `Blocked`, `Completed` (merged), `Open` (PR open, awaiting merge),
`Verified` (already true; no change).

## Priority 1: wrong data and broken behaviour

### R-01 Credit grants disappear after an end date is set
- **Problem.** Editing a plan credit grant's end date archives it at once. The backend
  `UpdateCreditGrant` calls `DeleteCreditGrant` when `end_date` is sent, and for plan-scoped grants that
  sets `status = archived` regardless of the date (`internal/ee/service/creditgrant.go` 487-588).
  `GetCreditGrantsByPlan` lists published only, so the grant vanishes. Add-on and contract grants keep
  `end_date` but no screen shows it.
- **Layer.** Backend (store `end_date`, archive only once it passes) plus console (show the end date,
  mark ended grants).
- **Depends on.** A backend PR in `flexprice`.
- **Acceptance.** A plan grant with a future end date stays listed with that date. A past end date
  shows it as ended. Add-on and contract grant tables show the end date.
- **Status.** Partly open: #221 (the plan grant form no longer offers an end date, so it cannot archive a grant by accident; add-on and contract grant tables show Ends). Blocked: a future end date on a plan grant needs the backend change, and a product call on what an ended plan grant means for existing contracts.

### R-02 One status-to-colour registry with the agreed semantics
- **Problem.** `PillTone` has no blue. `--info` is violet, so every `info` chip is purple: finalized,
  scheduled, processing, draft and more. About 15 maps disagree; contract status alone has four.
- **Target.** Green = paid, success, active. Yellow = pending, waiting, overdue, failed (to confirm).
  Blue = finalized. Purple = trialing only. Gray = cancelled, refunded, voided, terminal.
- **Layer.** UI kit: a blue `info` token, a violet `trial` tone, one registry in `pages/shared`, and
  every badge and grid moved onto it. No backend change.
- **Acceptance.** No chip other than trialing is violet. Each enum has one tone wherever it shows.
  Stories cover each status.
- **Open question.** Overdue and failed are red today, and the agreed palette has no red. This PR
  keeps them red until told otherwise.
- **Status.** Open: #199.

### R-03 One definition of "overdue", and an honest invoice status column
- **Problem.**
  - The console derives overdue from the exact due time.
  - The hosted page uses the calendar day and ignores the balance. A $0-remaining invoice with a
    pending payment shows "Due" there and "Paid" in the console.
  - The list's derived "Status" column is hidden and mixes payment into document status.
  - The legacy `?status=` URL path filters paid and overdue on the loaded page only.
- **Layer.** Domain (`invoice.ts`, `hostedInvoice.ts`) and the list page.
- **Acceptance.** One `isOverdue` used by both pages. The list column is labelled for what it shows.
  `?status=` either filters correctly or is removed.
- **Status.** Open: #200.

### R-04 Hosted invoice actions on invoice detail and list
- **Problem.**
  - The detail page has no "Open hosted invoice".
  - "Payment link" shows the raw URL and still says "payment" on paid invoices.
  - The list offers the hosted link on void and skipped invoices.
- **Acceptance.**
  - Detail has "Open hosted invoice", labelled by state.
  - The list hides it on void and skipped invoices.
- **Status.** Open: #201.

### R-05 Auto top-up cool-off: a toggle, and clearable
- **Problem.** Cool-off is a value and unit with "None" as the placeholder. A blank value is not sent,
  so a saved cool-off cannot be cleared. The units lack seconds. The unmerged branch
  `fix/auto-topup-cooloff-clear` touches this.
- **Acceptance.**
  - A Cool-off switch. Its fields show when it is on.
  - Turning it off clears the stored cool-off.
  - Existing values load.
- **Depends on.** Check that branch first and build on it, rather than duplicate it.
- **Status.** Open: #202.

### R-06 Wallet transactions: metadata and nested consumption
- **Problem.** `toWalletTransaction` drops `metadata`, `parent_transaction_id`, `consumption_breakdown`,
  `transaction_status`, `reference_*` and `source_*`. The backend and SDK return them. Child rows never
  appear. Reads are capped at 200 with no paging.
- **Acceptance.** Rows expand to their consumption breakdown. Metadata shows in the row's detail.
  Older transactions page in.
- **Status.** Open: #203.

### R-07 Customer portal: no zero-amount lines, and real "Load more"
- **Problem.**
  - Zero-amount lines show on the portal invoice sheet, the hosted invoice and the usage breakdown.
  - Wallet transactions "Show more" refetches from offset 0 with a growing limit.
  - Top-ups are a fixed 100 with a no-op "Show more".
- **Acceptance.**
  - Zero-amount lines are hidden where they mean nothing.
  - Transactions page 10 at a time by offset, with no duplicates and a clear end of list.
  - Invoice line items: the API returns them all, and paging needs a new endpoint (see Blocked).
- **Status.** Open: #204.

### R-08 Customer portal: negative credit balance
- **Problem.** A negative balance prints as a plain signed number, with no state.
- **Acceptance.** A negative balance reads as owed, in the warning tone, on the overview and the
  Credits tab.
- **Status.** Open: #205.

### R-09 Upcoming invoice preview: real unit price, interval and timing
- **Problem.** Unit price is derived as amount ÷ quantity, which is wrong for tiered, package and
  prorated lines. Interval and in-advance/in-arrears timing are missing.
- **Layer.** Join each line's `price_id` to the contract's lines in the query. The backend line item has
  no unit price.
- **Acceptance.** Unit price comes from the price (or reads "Tiered"). Interval and timing columns
  show.
- **Status.** Open: #206.

## Priority 2: missing pieces of existing flows

### R-10 Charge tables show "In effect" and "Billing timing"
- **Problem.**
  - Plan detail and feature detail use `layout="narrow"`, where both columns are hidden.
  - The contract wizard's charges table has neither.
  - The PlanForm staged list shows neither.
- **Acceptance.** Plan detail shows both by default. The wizard's charges table shows both.
- **Status.** Open: #207.

### R-11 Price actions use a price icon, not a pencil
- **Problem.** "Override price", the "Price changed" flag, the ChargeFlags price section and the
  ChargeSheet price section use `PencilIcon` tinted violet.
- **Acceptance.** `CircleDollarSignIcon`, untinted, for price actions. Pencil stays for real edits.
- **Status.** Open: #208.

### R-12 Optional bucket size when overriding a usage charge's price
- **Problem.** `PriceOverrideForm` has no bucket size. It can only be set inside the commitment dialog.
  `OverrideLineItemRequest.bucket_size` exists.
- **Acceptance.** Overriding a usage charge offers an optional bucket size, sent as `bucket_size`.
- **Status.** Open: #209.

### R-13 Contract-level true-up needs a commitment
- **Problem.** The True-up switch is always enabled. With no amount, `enableTrueUp` is silently
  dropped.
- **Acceptance.** True-up is disabled until a commitment amount is set, with a hint.
- **Status.** Open: #210.

### R-14 Add-on price override on a new contract
- **Problem.** The API takes `override_line_items` on an add-on. The console offers no price override
  for add-on charges.
- **Acceptance.** An add-on's charges can be repriced in the wizard and in the Add add-on dialog.
- **Status.** Blocked on #197 (add-on commitments), which touches the same add-on code.

### R-15 Contract detail: read-only metadata on cancelled contracts, and inherited contracts
- **Problem.**
  - Metadata stays editable on a cancelled contract.
  - Inherited (child) contracts show no parent, no invoicing customer and no read-only state.
- **Acceptance.** Metadata is read-only when cancelled. An inherited contract shows its parent and is
  read-only, as V1.
- **Status.** Partly open: #211 (cancelled contract metadata is read-only). #220 (an inherited contract shows its parent, is read-only, and the parent lists its inherited contracts).

### R-16 Activity: date range, actor filter, readable payloads
- **Problem.**
  - There is no custom date range or actor filter, though the backend supports `actor_id`.
  - Raw JSON does not wrap.
  - Metadata uses two narrow columns inside a narrow sheet.
- **Acceptance.** A date range and actor filter. Wrapped JSON. One metadata column in the sheet.
- **Status.** Partly open: #212 (the sheet stacks its metadata and wraps the raw payload). #219 (custom date range). The actor filter is still Pending.

### R-17 API keys: Revoke only where it will work
- **Problem.** A non-super-admin sees Revoke on keys owned by others and gets a 403. Revoke also shows
  on keys that are not published.
- **Acceptance.** Revoke is disabled with the reason for others' keys unless super admin, and hidden on
  revoked keys.
- **Status.** Open: #213.

### R-18 Webhook message sheet: loading and error states
- **Problem.** The sheet only opens once the message has loaded. A deep link shows nothing while it
  loads, and nothing at all on failure.
- **Acceptance.** The sheet opens at once with a loading state, and shows an error with Retry on
  failure.
- **Status.** Open: #214.

### R-19 Exports: S3 branding, less repetition, one status wording
- **Problem.**
  - No S3 logo.
  - Overview marketing cards stay up even when data exists.
  - The list says "Enabled/Disabled" and the detail says "Active/Paused".
  - The status is shown twice on the detail page.
  - Some empty-state copy is dead.
  - The guide link is generic.
- **Acceptance.** An S3 logo on the destination and connections. Overview collapses once there is data.
  One status wording, shown once. The docs link points at S3 exports.
- **Status.** Partly open: #215 (overview, tags and status wording). The S3 logo needs an asset download approved. The docs link is unverified.

### R-20 Integration copy: shorter, even cards
- **Problem.** Descriptions are 46 to 107 characters and mix styles. The disconnect copy is long.
  Card heights vary.
- **Acceptance.** One-line, action-led descriptions, clamped. A shorter disconnect confirm.
- **Status.** Open: #216.

### R-21 Customer onboarding: only wallet and contract, as V1
- **Problem.**
  - All five backend actions are offered. The transcript asks to remove create customer, add
    feature/price and rollout.
  - The plan is a free-text id.
  - Each step's label shows twice.
  - The raw workflow type is shown.
- **Acceptance.** Steps are wallet and contract only (others kept if already saved, not addable). A plan
  picker. One label per step.
- **Status.** Open: #217.

### R-22 Duplicate identifiers
- **Problem.** Customer detail shows External ID and ID in the header and again in the details card.
  The export detail shows its status twice (covered by R-19).
- **Acceptance.** Each identifier shows once, copyable.
- **Status.** Open: #218 (customer IDs). The export status shown twice is fixed in #215.

### R-23 Invoice list: one integration-mapping request, not one per row
- **Problem.** `useEntityIntegrationColumns` makes one request per visible invoice. The API takes
  `entity_ids[]`.
- **Acceptance.** One batched request per page.
- **Status.** Blocked: `GET /integrations/mappings` takes a single `entity_id` (`internal/api/v1` `GetMappings`). Only the repository has a multi-id filter. Needs the handler to accept `entity_ids`.

## Priority 3: transcript items to verify, then fix if still open

### R-24 Invoice edit: invoice status, payment status and due date
- **Transcript.** "Changing an invoice status, changing the payment status, editing the due date … is
  missing."
- **Acceptance.** Verify. Add whatever the API supports (`PUT /invoices/{id}/payment`, void).
- **Status.** Verified: invoice edit sets the due date (`InvoiceForm`). "Update payment status" and "Void invoice" are in the detail page's More menu. Finalized to voided is the only status change the API allows.

### R-25 Record payment: pay from credits, and drop unsupported methods
- **Status.** Verified: Record payment offers Credits, drawn in the wallet's currency (`PaymentForm`, `RECORDABLE_PAYMENT_METHODS`).

### R-26 Recalculate invoice for drafts
- **Status.** Verified: "Recalculate invoice" is in More, for drafts (`InvoiceDetailView`).

### R-27 API key created dialog: larger, readable copy button; no close until saved
- **Status.** Verified: the created-key dialog closes only via "I have saved it" and has a labelled copy button (`ApiKeysPanel.tsx`).

### R-28 Team: ⋯ menu for edit role and remove; invite states
- **Status.** Verified: Team rows use a row menu with "Edit roles" and Remove (`MembersPanel`).

### R-29 Portal appearance: hex code beside each colour
- **Status.** Verified: portal colours have a hex input with a live swatch (`PortalPanel`).

### R-30 Wallets: wallet type chip, wallet metadata
- **Status.** Verified: the wallet type chip is on the wallet card (`CustomerWalletView`), and wallet metadata shipped in #139.

## Product decisions (not built until decided)

### R-31 Usage-only plan preview and pricing-widget tile wording
- **Problem.**
  - A usage-only plan reads "Usage-based" and "plus usage" in the preview.
  - The widget tile shows "$0.002 / month", which is misleading.
- **Open question.** The exact customer-facing wording is a product decision. The tile's
  "$0.002 / month" is wrong whatever the wording, so it can be fixed now.
- **Status.** Blocked: the pricing widget's tile is a vendored block (`solution-billing-2/plan-tile`). It takes only a monthly number, so a usage-only plan can't be shown honestly without a new kit tile and agreed wording.

### R-32 Chart area fills
- **Status.** Blocked on product (suggestion only). Single-series charts already fill at 12% to 1%.

### R-33 Analytics: show "cost unavailable" apart from "no cost sheet"
- **Problem.** A failed cost read shows "—", the same as having no cost sheet.
- **Status.** Pending: needs the backend's behaviour without a cost sheet (an error code, or an empty reply) confirmed before "unavailable" can be told apart from "none".

## Blocked on backend or environment

### R-34 Change password while signed in
- **Blocker.** There is no endpoint. The console has no Supabase session to call `updateUser` with.
  Needs a backend endpoint or a session.
- **Status.** Blocked.

### R-35 Tenant onboarding form (organization name, URL, referral)
- **Blocker.** V1 posts these to an external Apps Script sheet, not the API. Only the tenant name has
  an API.
- **Open question.** Where the rest should go.
- **Status.** Blocked.

### R-36 Portal invoice line items: paged "Load more"
- **Blocker.** The portal `GET /invoices/:id` returns all lines. A paginated line-item endpoint is
  needed.
- **Status.** Blocked.

### R-37 Customer payments in one request
- **Blocker.** `PaymentFilter` has no customer filter, so customer detail makes one request per
  invoice. Needs a backend filter.
- **Status.** Blocked.

## Verified (already true; no change)
- **Contract wizard has a Review step:** `SubscriptionForm.tsx` `SUBSCRIPTION_FORM_STEPS` and
  `ReviewStep`.
- **Cancelled and terminal contracts hide edit actions and the preview:**
  `SubscriptionDetailView.tsx` `canEditCharges`, `canModify`.
- **Charge alerts on contract usage lines:** `ChargeSection.Alerts` and More › Alert settings.
- **Fixed charges never offer a commitment:** detail and wizard. The API refuses them.
- **Add-on commitments:** #197.
- **Push to Stripe:** shown only with a connection whose customer outbound sync is on.
  `CustomerDetailPage.tsx` gating.
- **Customer portal:** per-customer link, card gating by gateway capability, and empty states for no
  plan, usage, card, wallet or invoices.
- **Wallet alert thresholds:** `EntityAlertDialog`, `alert_settings`.
- **Events page:** columns and properties `CodeBlock`. Webhook attempts show payload and response.
- **Customer Activity tab:** what, when, who and resource; an event sheet; actor types user, API key,
  customer and system; cursor paging; "View all".
- **Hosted invoice:** merchant name left-aligned, preview and download, honest "Online payment isn't
  available" copy.
- **No test-only banners in production pages:** the mock-accounts group is gated by `useMocks`.

## Progress

| Task | PR | Status |
|---|---|---|
| Task list | #198 | Open |
| R-02 Status colours | #199 | Open |
| R-03 One overdue rule | #200 | Open |
| R-04 Hosted invoice actions | #201 | Open |
| R-05 Cool-off switch | #202 | Open |
| R-06 Wallet breakdown | #203 | Open |
| R-07 Portal Load more, zero lines | #204 | Open |
| R-08 Portal negative balance | #205 | Open |
| R-09 Preview unit price | #206 | Open |
| R-10 Charge table columns | #207 | Open |
| R-11 Price icon | #208 | Open |
| R-12 Override bucket size | #209 | Open |
| R-13 True-up needs commitment | #210 | Open |
| R-15 Cancelled metadata read-only | #211 | Open |
| R-16 Activity sheet readability | #212 | Open |
| R-17 API key Revoke gating | #213 | Open |
| R-18 Webhook sheet states | #214 | Open |
| R-19 Exports tidy | #215 | Open |
| R-20 Integration copy | #216 | Open |
| R-21 Onboarding steps | #217 | Open |
| R-22 IDs once | #218 | Open |
| R-16 Custom activity range | #219 | Open |
| R-15 Inherited contracts | #220 | Open |
| R-01 Plan grant end date (console half) | #221 | Open |
| Add-on commitments (prior work) | #197 | Open |

**Merging.** None of these is merged. The session's permission check refuses `gh pr merge` ("Merge Without Review"), so each PR is left for a person to merge.

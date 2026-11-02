Title: One status colour language: blue finalized, violet for trialing only

Old reference: `--info` was violet, so every `info` chip (finalized, scheduled, running, processing, draft, overpaid,
credit memo) was purple. About 15 per-component maps disagreed: a contract's status had four different colours,
cancelled was red in some places and grey in others, and finalized was violet, grey or green depending on the page.
New reference: `--info` is blue. A new `--trial` token (violet) is used by trialing alone. Every badge and grid reads its
tone from one registry, `pages/shared/statusTones.ts`:
- green: paid, succeeded, overpaid, active, completed
- yellow: open, pending, processing, paused, incomplete, scheduled, running, sending
- blue: finalized
- violet: trialing
- grey: draft, cancelled, refunded, voided, skipped
- red: overdue, failed

Why: review 2026-10-26. The agreed semantics are green done, yellow waiting, blue finalized, purple trialing only,
grey terminal.

Affected:
[x] tokens: `--info` violet -> blue (light 500/900, dark 500/400); new `--trial` / `--trial-foreground` (violet)
[x] shared: `PillTone` gains `trial`; `STATUS_TONE` in `cells.tsx`; new `statusTones.ts` registry and palette story
[x] pages: invoice, payment, contract, credit note grids and badges; invoice and credit-note header chips; workflows,
    exports, webhooks, customer portal, customer activity
[x] visual baselines: any route with a status chip
[ ] typography: unchanged

Open question: overdue and failed stay red. The agreed palette names no red; they move when that is decided.

Migration: none. Callers keep `<Pill tone>`; `info` now renders blue.

Follow-up 2026-11-02 (from the 2026-10-26 walkthrough: "purple only for trialing", "end state is grey"):
- Red stays as the sixth tone, for a problem that needs action (overdue, failed); the walkthrough ruled failure out of
  grey. This closes the open question above.
- `past_due` / "past due" moves yellow -> red, to match overdue.
- Workflow `TimedOut` moves yellow -> grey: it is an end state, like `Terminated`.
- Pricing widget: SMS/message and default metered-feature icons move violet -> blue; the "+ Usage" label drops violet
  and inherits the muted period text. Violet is now used only for trialing (the "Create with AI" wand keeps its own AI
  accent, which is not a status tone).

Follow-up 2026-11-02, invoice list: the invoice grid's "Status" column showed the derived status (Open / Paid /
Overdue), which repeats the payment status column beside it. It is now "Invoice status" and shows the document's own
`invoice_status`, matching the filter of the same name: Draft grey, Finalized green, Voided yellow, Skipped grey
(`INVOICE_DOCUMENT_STATUS_TONE`). This is the invoice document only; credit-note Finalized stays blue, and voided
payments and credit notes stay grey.

Follow-up 2026-11-02, one list: every status colour now comes from `STATUS_WORD_TONE` in `pages/shared/statusTones.ts`,
read through `statusTone(word)` or a per-enum map built from it (invoice, invoice document, payment, contract, portal
plan, credit note, wallet, price version, webhook delivery, workflow). The local maps in cells, wallets, charges,
versions, exports, workflows, webhooks, the payment dialog, the invoice and credit-note header chips and the customer
invoices tab are gone. Decision (product, 2026-11-02): Finalized is green and Voided yellow on every page, not just the
invoice list, so one status word is one colour everywhere. Blue is now only "upcoming". This supersedes the
finalized-blue and voided-grey lines above.

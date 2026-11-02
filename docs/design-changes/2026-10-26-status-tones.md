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

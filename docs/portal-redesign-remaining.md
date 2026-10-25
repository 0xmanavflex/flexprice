# Portal redesign: still to do

Written October 16, 2026, from `docs/portal-redesign-action-plan.txt` and the work recorded after it. Items already shipped are left out. Caveats on shipped items are listed only where the plan still calls the item incomplete.

Nothing here has been committed, pushed, or checked against a live tenant. Published SDK 2.1.35 and the swagger fetched on October 16 are contract evidence, not proof that every deployment supports the operations.

## Blocked on a backend contract

These cannot be finished in the portal by wiring a different existing call.

| Item | What is left | Why it is blocked |
| --- | --- | --- |
| 37 | Revert on the immediately previous charge version, with confirm, error handling, and refresh | No version list or revert path in the SDK or published swagger |
| 38 | Line-item version listing and revert | Same gap. Modify preview/execute does not define ancestry, eligibility, or re-rating |
| 51 | Write that version/revert contract: fields, errors, re-rating, which version can be restored, what to refresh | Needs the billing API repository |
| 14 | Payments columns: receipt number and customer | The payment read model has neither. Gateway reference stays labeled as itself. Integration column is already present |
| 17 | Add-on contract counts | Subscription search cannot count contracts per add-on (`addonLinkage.ts`) |
| 39 | Credit memo metadata in the rail | The memo read model does not expose metadata |
| 40 | Settlement footer that states refund destination or a completed transfer | The API exposes a status, not that destination |
| 35 (remainder) | Tiers that belong to one commitment window | `TimeOfDayBucket` returns `priceId` only. The sheet shows UTC range, commitment, and Rest of the day. Bands render only when they are already on the window |

## Open product decisions (item 55)

Record a decision before changing the current behavior.

- Narrow charge flags: two labelled flags, or icons only? Current behavior is the first two labelled and the rest icon-only with tooltips.
- Link integration: overflow on every detail page, or Plan only? Plan already uses the overflow menu.
- Plans list: adopt the proposed combined Includes column (“6 features · 2 grants”), “6 active” contracts, and charge names on hover? Item 18 treats this as a proposal, not a prototype requirement.
- Where contract Phases and Tax associations live. Keep the current surfaces until that is decided.

## Pages not built to the reference yet

**Feature (27).** Overview / Information. Overview shows charges grouped by the plan they belong to, plus entitlements. Information shows the create form read-only.

**Customer (29).** Tabs: Overview, Invoices, Wallet, Analytics, Events, Information. Remove the Tax tab only after its current tax actions have a home. Overview order: ARR, days sales outstanding, last invoice, next invoice, then Contracts, Recent invoices, Recent payments. Wallet: real-time balance first, last invoiced balance second, ledger grouped by top-up.

**Revenue (42–48).** Depends on item 53.

- Default range Last 90 days, no comparison.
- Weekly buckets on short ranges, monthly buckets on yearly ranges, using the API’s real boundaries.
- Cards: Revenue, ARPU, Outstanding, Overdue.
- Change indicators only on Revenue and ARPU, and only when comparison is on. Outstanding and Overdue are as-of today.
- Panels: Revenue over time, Receivables aging, Days to pay over time, Top 5 customers, Credit consumption vs. top-ups.
- Loading, error with Try again, and empty states.
- Every Revenue tab uses the same selected range. Other tabs keep their current behavior.
- Chart evidence for Agrim. Do not treat missing sign-off as approval.

**Home (49).** One granularity/range row. Chart tabs: Events, Revenue, Processing lag. Recent contracts. Half-donut for invoice payment status.

**Pricing widget (50).** Compact “What customers see” plan cards, one Monthly / Annual switch, working embed code under the cards.

## Shared layout still open (05–09)

- Activity → Metadata → Related on every applicable detail page. Plan and Feature keep their documented exceptions. Credit memos stay Activity → Related until metadata exists.
- Header integration logos instead of body mapping cards, on the pages that still use the old card. Copy, open, and unlink must share one refresh with the Related row.
- Open in the provider only after a real external URL exists. Prototype placeholder URLs stay out.
- Remaining nested tables whose Add action is still inside the empty body, or whose title/action moves when the table is empty.
- List tables that still differ from the shared rules: grey header, borderless rows, row navigation, search/filter/sort/columns, centred counts, muted dash for zero, short copyable IDs, integration logos. Copy and menu clicks must not also navigate. Status is a filter, not a list tab.
- List empty states: illustration, primary and secondary actions, three guide cards, and a real destination for each action.

## List columns still short of the reference

- **Invoices (12).** Date, due date, amount, amount due, and payment status match. Integrations are wired from entity mappings and still need a live check. Document status stays a filter.
- **Features (15) and Plans (16).** Columns match. Charge, entitlement, grant, and contract counts still need a live definition and a performance check (item 54).
- **Customers (10) and Contracts (11).** Columns match. Contract counts on the customer list still need a live check.
- **Payments (14).** Integration is done. Receipt number and customer are the blocked fields above.
- **Add-ons (17).** Type pill matches Plans. Contract count is the blocked field above.

## Charges still short of the reference

- **31.** Finish Charge / Price / Flags, optional Quantity on wide tables, the short grey model line, and the tier count, on every consumer. No row expansion.
- **32 and 34.** Flags and sheet sections already share coupon and alert data, in the order Price, Discount, Commitment, Alerts, History. Live tenant coverage of those reads is still open. Narrow-flag behavior waits on item 55.
- **33.** Sheet focus and scroll are in place. A broader keyboard pass (open, move, close) is still open.
- **35.** Window layout is in place except the price bands noted under blocked work. “Every …” follows the charge’s bucket when `bucketSize` is set, and the billing period when it is not.
- **36.** Versions are newest first, with start, end, and last updated, and the current version is highlighted. Author shows when the payload includes it. A dedicated version list endpoint is still unverified.
- **37 and 38.** Blocked, above.
- Coupon change and alert edit on the sheet are implemented. They have not been exercised against a live tenant. Creating an alert on a charge that has none is not the Edit action.

## Backend checks that unlock later UI (52–54)

- **52.** Coupon and alert reads are already one parent query, not one request per charge. Confirm that stays true under a live page size, and that a flag never appears without the matching sheet section.
- **53.** Confirm the revenue API’s 90-day default, optional comparison, weekly versus monthly buckets, and the exact date boundaries. Items 42–48 wait on this.
- **54.** Confirm catalog count fields: what “contracts”, “charges”, “entitlements”, and “grants” mean, and that a list page can load them without a request per row.

## Verification still open on work already built

- Live tenant calls for navigation, lists, charge edits, coupon change, alert save, and integration link/unlink.
- Mapping-list performance: invoice, plan, and payment integrations are one request per row on the current page. No batch endpoint was found.
- Linux visual baselines. macOS runs have mismatches that were reviewed and not rewritten. Do not update baselines from those diffs.
- Narrow-width review beyond the credit memo document and the detail header.
- Production build warnings that already existed (chunk size, Vite config loader) are unchanged and not part of this redesign.

## Suggested order

1. Item 55 decisions that change layout (flags, link integration, plan counts, phases and tax).
2. Shared rails and list empty states (05–09) that do not need a new API.
3. Feature detail (27) and Customer detail (29), after tax has a destination.
4. Revenue only after item 53. Home and the pricing widget after that.
5. Version revert only after item 51. Window tiers only after the line item returns the window price, not just `priceId`.

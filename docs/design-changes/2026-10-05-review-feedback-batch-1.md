Title: Review feedback, batch 1: no bell, white Create, field hints behind (i), pricing tiles capped at three features

Old reference: a notification bell beside the tenant name; a filled primary "Create" button in the header; a
muted sub-line under every form label; pricing widget tiles listing every feature.
New reference: the sidebar header carries the tenant name and the theme toggle only; the header Create button is
the outline (white) variant; a field's explanation sits behind an (i) beside its label (`InfoHint`), opening on
hover, focus or tap; each pricing tile shows three features, then "Show N more features".

Why: product review with the design owner on 2026-10-05. Notifications are not wired to anything yet, primary
colour is kept for the one action on a page, forms over-explained themselves, and the widget was cluttered.
Headings keep their subtitles; only text under labels moved.

Affected:
[x] shell: `AppShell` (notification props, `ShellNotifications` and its types removed), `ShellCreateMenu` (variant)
[x] shared compositions: new `InfoHint`; `Field` and `FormRow` render hints through it. The hint stays in the DOM
    as screen-reader text, so `aria-describedby` still resolves.
[x] pages: `PricingCatalogBlock` (adapter-side cap; the vendored `PlanTile` is untouched)
[x] visual baselines: every route with the shell, plus every form route
[ ] tokens, typography: unchanged

Retired: the notification bell and `ShellNotifications`; sub-lines under form labels; the filled header Create button.

Decision: design owner, 2026-10-05.

Not in this batch (open in the review notes): features-page "detailed section" (unclear which element), chip and
table restyling, the empty-plan "add charge" state, revenue-by-customer (no backend endpoint), feature edit as a
full page, usage-alert toggle in the header, customer portal.

Migration: callers that passed `notifications` to `AppShell` drop the prop.

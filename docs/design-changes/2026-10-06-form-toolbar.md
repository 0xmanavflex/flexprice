Title: Simple create/edit forms open with a pinned toolbar (ReUI form-3)

Old reference: `Composer` in the reference app (`detail.tsx`), a form whose Cancel and submit sit in a row at the foot of the form, under a titled Section.
New reference: ReUI `form-3`: a bar pinned above the page with close, the title, Cancel and the primary CTA, and the form cards directly beneath it.

Why: requested by the product owner on 2026-10-06. Forms with only one or two required fields should be quick to create: the CTA is always in view, with no scrolling to the foot of a long page to submit.

Affected:
[x] shared compositions: new `FormToolbar`; `FormPage` gains a `toolbar` prop (the `footer` prop is unchanged); `FormCard` gains an optional Required/Optional `status` badge
[x] pages: `CustomerForm`, `AddonForm`, `CostSheetForm`, `GroupForm`; the outer Section surface is gone in toolbar mode and the form cards are the surfaces
[x] visual baselines: `customers-new`, `addons-new`, `groups-new`, `cost-sheets-new` and their edit routes, adopted from CI
[ ] tokens, typography, shell/sidebar: unchanged; the vendored `form-3` block is not edited

Retired: the bottom actions row and the Section heading on these four forms. Other forms keep `footer` until they are moved.

Decision: product owner, 2026-10-06.

Migration: none. Submit handlers, validation and the `FORM_ID` wiring are unchanged; the CTA is not disabled while the form is invalid, so errors still appear on submit.

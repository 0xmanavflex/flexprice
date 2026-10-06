Title: Staged and preview forms share the toolbar page, with the stepper in the header (ReUI c-stepper-1, solution-billing-8)

Old reference: Subscription and Plan forms drew their steps inline above the fields, with Cancel/Previous/Next at the foot and a hand-placed preview card; Customer, Coupon, Feature and Price-unit forms laid out their own preview grid.
New reference: ReUI `form-3` (pinned toolbar) for every form; `c-stepper-1` (numbered stepper in the header band, current step captioned) for staged forms; `solution-billing-8` (live preview rail with a dashed headline figure, titled sections and label/value rows) for forms that preview what they create.

Why: requested by the product owner on 2026-10-06. One form component, with the stepper and the preview each optional, so a form is assembled from a schema, a submit handler and (if wanted) a stepper and a preview, and every form looks and behaves the same.

Affected:
[x] shared compositions: `FormPage` gains `stepper` and `preview`; new `FormPreview` family; `WorkflowStepper` gains a `header` variant; `FormToolbar` gains `hideSubmit`; `useFormSteps` gains `StepNav`
[x] pages: all forms moved off `footer`/`FormActions` onto `toolbar`; Subscription and Plan take `stepper` + `preview`; eight preview cards render through `FormPreview`
[x] visual baselines: every form route, adopted from CI
[ ] tokens, typography, shell/sidebar: unchanged; vendored blocks are not edited

Honest note on "use the block's own component": the vendored `form-9`, `solution-billing-8` and `c-stepper-1` export only whole demos (or, for the stepper, a pattern over `@ui/components/reui/stepper`). The proration rail, its amount and summary rows, and the stepper markup are private to those demos and cannot be imported, and vendored files are hash-locked. The compositions therefore rebuild the same markup and tokens fed by props; each provenance note records the lineage. `form-9`, `tree` and `@headless-tree` are vendored and unused until a schema-driven permission form needs them.

Follow-up, same day: the main content of every form is ONE form-9-style card (title/description/badge header, dashed inset rules, title + visible description left, control right) instead of several stacked cards; stepper forms show one card per step. Hints are visible under the row title, matching form-9, instead of an info icon.

Follow-up: the stepper is drawn inside the toolbar row (title left, numbered dots centred, Cancel/CTA right), with no visible step caption.

Retired: the inline stepper and bottom actions row on Subscription and Plan; the per-form preview grids.

Decision: product owner, 2026-10-06.

Migration: none for callers outside `@fp/ui`. Submit handlers, validation and `FORM_ID` wiring are unchanged; the primary action appears on the last step (any step when editing).

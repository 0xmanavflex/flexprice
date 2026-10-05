Title: New subscription form uses the plan/customer create layout

Old reference: a narrow single-card stepper titled "New subscription".
New reference: the plan and customer create pages (`PlanForm`, `CustomerForm`): `FormPage` at `width="wide"`,
the form on the left, a sticky live preview card on the right (`lg:grid-cols-[minmax(0,1fr)_21rem]`).

Why: requested by the product owner on 2026-10-05 so the three create flows look and behave alike.

Affected:
[x] pages: `SubscriptionForm` (non-embedded); new `SubscriptionPreviewCard` (a summary of customer, plan, billing, overrides)
[x] visual baselines: `subscription-new`
[ ] tokens, typography, shell/sidebar, shared compositions: unchanged (`FormPage` is used as-is)

Retired: the narrow "New subscription" card layout. The customer-embedded form keeps its dialog-style layout (no preview).

Decision: product owner, 2026-10-05.

Migration: none. The stepper, validation and submit logic are unchanged.

# Flexprice Console — UI Revamp

> **Partly superseded.** The architecture rules here (no data fetching in UI, URL-addressable tabs, loading/empty/error states) still apply. Its visual rules and the "exists, extend these" composition table do not: see `UI_SOURCE_OF_TRUTH.md` for the current vocabulary and `docs/ui-page-matrix.md` for what each page uses.

The V2 console is a **UI systemization** effort, not a component swap. ReUI (Base
UI / `base-nova`) supplies the primitives and proven interaction patterns; the
Flexprice **composition layer** (`@fp/ui`) owns the resulting design system, and
pages consume compositions rather than assembling raw primitives.

```
        Base UI / ReUI                 Flexprice UI (@fp/ui)
   Button · Input · Tabs          DetailHeader · ResourceNavigation
   Dialog · Dropdown · Field      Section · DetailList · DataGrid parts
   DataGrid · Chart · Sheet       EmptyState · StatusBadge · ConfirmDialog
              └──────────────┬───────────────┘
                           Page
                     ┌───────┴───────┐
                   Query           Actions
                     └───────┬───────┘
                            SDK → Backend
```

> **The goal is not "make Flexprice look like ReUI."** ReUI is copy-and-own: the
> components land in our repo and inherit our tokens. Flexprice owns the design
> system and the compositions built on top.

---

## The rules of UI

1. **No new one-off primitives.** Reach for a ReUI primitive or an existing `@fp/ui` composition first.
2. **Base UI / ReUI for V2 components.** New surfaces use `base-nova`.
3. **V1 Radix components stay stable.** Don't churn a page that isn't being migrated.
4. **Pages compose `Section` / DetailKit parts, never the `Card` primitive, never raw table primitives.** A page section is the reference `Section` (`bg-background flex flex-col rounded-xl border`, header `border-b px-6 py-4`); tables are `SimpleTable` or the shared grid. `Card` is a primitive for compositions only.
5. **Detail pages use `DetailHeader` + `ResourceNavigation`.** Every entity opens the same way.
6. **Tables use the shared grid parts** (`GridToolbar`, `GridFooter`, `FilterBar`, `SortMenu`, the ReUI Data Grid). No bespoke `<table>` per resource.
7. **Creation flows use the shared form primitives** (`Field` + RHF + Zod).
8. **Steppers only when the workflow genuinely has stages** (`WorkflowStepper`). Don't wrap a four-field form in one.
9. **Every async surface has loading / empty / error states** (`LoadingRows`, `EmptyState`, `ErrorState`).
10. **UI components don't fetch data.** No React Query, no SDK, no mutations inside `@fp/ui`.
11. **Business logic doesn't live in UI components.** Pages own queries and actions; compositions take data and callbacks.
12. **Section tabs are URL-addressable** (`?tab=…`), so a section is a link.
13. **Status colors are semantic, not decorative.** Published = subtle green, Draft = neutral, Archived = muted, Metered = subtle blue, Boolean = subtle purple, Error = red. No rainbow of badges.
14. **Actions follow consistent placement.** Primary + overflow to the right of the header; resource-level "Add …" inside the section it acts on.
15. **Every reusable component gets Storybook coverage** — default, loading, empty, error, long content, dark mode, responsive, interactive — with the a11y + interaction test the project runs on every story.

---

## Proposed names → what already exists

Most of the "Flexprice UI system" is **already built**. Extend these; do not
duplicate them under a new name.

| Proposed pattern         | Use the existing composition                                             | Status |
| ------------------------ | ----------------------------------------------------------------------- | ------ |
| `ResourceDetailLayout`   | `DetailShell`                                                            | ✅ exists |
| `ResourceHeader`         | `DetailHeader` (breadcrumb, title, badges, identifier, actions)         | ✅ exists |
| `ResourceNavigation`     | `ResourceNavigation` (line-variant section nav, `aria-current`)         | ✅ **new** |
| `DetailSection`          | `Section` (heading assoc + action slot)                                  | ✅ exists |
| `DetailField` / `FieldGrid` | `DetailList` / `DetailItem`                                           | ✅ exists |
| `ResourceStats`          | `DetailStats`, `MetricRail`, `StatCards`, `Metric`                       | ✅ exists |
| `DataGrid`               | ReUI `data-grid` + `GridToolbar` + `GridFooter` + `FilterBar` + `SortMenu` + `useViewportPageSize` | ✅ exists |
| `EmptyState`             | `EmptyState` (+ `ListState` / `ListOffer` for first-run vs filtered)     | ✅ exists |
| Loading skeletons        | `LoadingRows`, per-component shimmers (`Metric`, grid column-aware rows) | ✅ exists |
| Error states             | `ErrorState`, `AppFailure`                                               | ✅ exists |
| `PageHeader` / `PageToolbar` / `PageSection` | `PageHeader` / `PageToolbar` / `PageBody` + `Section`      | ✅ exists |
| `StatusBadge`            | `StatusBadge`, `CatalogStatusBadge`, `FeatureTypeBadge`, `InvoiceStatusBadge`, `SubscriptionStatusBadge`, `PaymentStatusBadge` | ✅ exists |
| `ConfirmDialog`          | `ConfirmDialog` (destructive confirmation)                               | ✅ exists |
| `EditSheet`              | `Sheet` primitive + per-resource editor sheets (`PlanEditorSheet`, `AddonEditorSheet`, `CouponEditorSheet`, `PriceUnitEditorSheet`) | ✅ pattern exists |
| Forms                    | `Field` + RHF + Zod                                                      | ✅ exists |
| `CreateLayout`           | `WorkflowStepper` + `SubscriptionCreatePage` as the reference           | ◻ generalize |
| `ActionMenu`             | `dropdown-menu` primitive (used ad hoc)                                  | ◻ standardize |
| `CodeExample`            | —                                                                        | ◻ new (ingestion snippets) |

**Genuinely new work:** `ResourceNavigation` (done), `CodeExample`, a standard
`ActionMenu`, a generalized `CreateLayout`, and **adopting `ResourceNavigation`
across the detail pages** that currently roll their own tabs.

---

## Interaction model

- **Sheet** — quick edit, add a charge / entitlement / credit grant, view metadata.
- **Dialog** — confirmation, destructive actions, small focused forms.
- **Full page** — complex creation / editing, multi-step configuration.

---

## Phases

**Phase 1 — Foundation** *(largely complete)*
Tokens, Base UI, shell (sidebar, top bar, environment switcher, profile), buttons,
inputs, badges, dropdowns, dialogs, tabs. Remaining: keep tightening density,
surface hierarchy, and responsive behavior.

**Phase 2 — Detail system** *(mostly exists; finishing)*
`DetailHeader`, `ResourceNavigation` (new), `Section`, `DetailList`, stats,
`EmptyState`, the shared grid. Next: adopt `ResourceNavigation` on the detail
pages and settle "section = the reference `Section`, never the Card primitive."

**Phase 3 — Product Catalog** — Features, Plans, Coupons, Add-ons, Price Units, Groups, Cost Sheets.

**Phase 4 — Billing** — Subscriptions, Invoices, Payments, Usage, Credits.

**Phase 5 — Revenue** — Revenue dashboard *(shipped)*, recognition, reports.

**Phase 6 — Remaining** — Developers, Integrations, Settings, Portal.

---

## Reference implementations to finalize first

Per the direction, the four patterns that unlock the rest:
`DetailHeader → ResourceNavigation → Section → DataGrid`. Once one detail page
(Feature or Plan) is rebuilt purely on these four, the others inherit the same
visual language instead of each becoming another custom page.

## Recently landed

- **Overview** (`DashboardHome`) rebuilt as a billing surface — KPI strip, revenue trend, revenue-by-customer, subscriptions-by-plan, metered usage — composed from `Metric` / `Section` / `Chart` / `Table`, replacing the vendored sample block (and its stray "Add" button).
- **Revenue** (`RevenueDashboard` + `/revenue`) shipped: KPI strip, contract/usage mix, revenue by customer, gross margin by feature.
- **`ResourceNavigation`** composition added (line-variant section nav).
- Sidebar: dropped the redundant "Workspace" group heading over the single primary tree.

# UI source of truth

The working checklist for building a page is [`docs/design-rules.md`](docs/design-rules.md); this file is the
background behind it.

There is one answer to "what should this page look like?": **the reference app**. Everything else in this
file explains how the code is organised so that answer stays true.

If any other document, comment or habit disagrees with this file, this file wins. If the reference app and
this file disagree, the reference app wins and this file is the bug.

## The reference

| What                                                  | Where                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Reference app (Vite + Tailwind v4 + shadcn base-nova) | `flexprice-dashboard-redesign`, pages in `src/app/pages`, kit in `src/app/components`, shell in `src/app/shell` |
| Reference component map                               | `COMPONENT_MAP.md` in that app                                                                                  |
| Reference-to-route map                                | `apps/console/e2e/visual/routes.ts` (the `reference` field of each route)                                       |
| Rendered baselines                                    | `apps/console/e2e/visual/__screenshots__/` (see `apps/console/e2e/visual/README.md`)                            |

## Tokens (frozen)

Defined once, in `packages/ui/src/styles.css`. No other file defines a colour, font or radius.

| Token    | Value                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Typeface | Geist Variable (`@fontsource-variable/geist`)                               |
| Weight   | `font-medium` is the heaviest. No `font-semibold`, no `font-bold`.          |
| Primary  | `#0f2a3d` light, `#1a70a2` dark                                             |
| Radius   | `--radius: 0.625rem`                                                        |
| Neutrals | the shadcn base-nova neutral ramp, as in the reference                      |
| Status   | ReUI extended tokens: `success`, `info`, `warning`, `destructive`, `invert` |
| Charts   | `--chart-1..5`                                                              |

One recorded deviation: `--muted-foreground` is `oklch(0.52 0 0)`, not the reference's `0.556`, because 0.556 fails
WCAG AA (4.5:1) on `bg-muted` and tinted alerts. Revisit with design.

Rules that follow from this:

- The theme does not restyle components. No `[data-slot=...]` overrides in `styles.css`. A page that looks
  different from the reference composed the wrong parts; it does not need another override.
- Pages use semantic tokens only: no raw palette colours (`text-red-600`), no bold weights. Lint enforces both.
- Font sizes in the reference's own vocabulary are allowed (`text-xs`, `text-sm`, `text-[13px]` as the reference
  uses it). New arbitrary sizes need a design decision; see "Known gaps" below.

## Page grammar

Pages are composed from a fixed grammar. They are configuration of shared parts, not new visual design.

**List**: `PageHeader` (title, description, actions) then `EntityList` (`FilterBar`, table via shared cells,
pagination). Empty state is `EmptyState`.

**Detail**: `DetailHeader` (breadcrumb, title, status, actions) then `DetailTabs`, then `Section`s holding
`Properties`, `SimpleTable`, `EntityList`, charts. Destructive actions go through `ConfirmDialog`.

**Create / edit**: `FormPage` with `FormCard` sections and `FormActions`, or `FormDialog` for short edits.
Steppers only when the workflow really has stages (`WorkflowStepper`).

**Settings**: the ReUI `settings-7` layout (`SettingsShell`): a "Settings" heading, a vertical rail of sections
with the active section's tabs nested under it (no second nav above the content), and a content column of `Section`s of
`Properties` / `settingsSurface` cards. This replaced the reference's line-tab strip by design change `docs/design-changes/2026-10-05-settings-7-layout.md`.

**Dashboard**: `Panel` and the shared chart kit. No bespoke chart components.

## Vocabulary

| Need                   | The only allowed building block                |
| ---------------------- | ---------------------------------------------- |
| Page header            | `PageHeader`                                   |
| Detail header and tabs | `DetailHeader`, `DetailTabs`                   |
| Contained surface      | `Section` (the one Card-like surface)          |
| Key/value fields       | `Properties`                                   |
| Lists and tables       | `EntityList`, `SimpleTable`, shared `cells`    |
| Charts                 | shared chart kit (`charts`, `viz`)             |
| Forms                  | `FormPage` + `FormCard`, `FormDialog`, `Field` |
| Empty state            | `EmptyState`                                   |
| Confirmation           | `ConfirmDialog`                                |
| Metrics                | `MetricRail`, `Metric`, `StatCards`            |

If nothing fits, that is a design decision (see `DESIGN_CHANGE.md`), not a licence to add a component. Do not
create per-entity copies of a kit part (`CustomerInfoCard`, `PlanTable`): the page passes data to the kit.

## Where the code lives

`packages/ui/src` reads top to bottom in the same order as Storybook: `design-system/` (tokens, page map),
`compositions/<group>/` and `pages/shared/` (Building blocks), then `pages/<nav area>/<entity>/` (App), one folder
per console sidebar area. `packages/ui/src/README.md` is the map. A new part goes in the folder of the screen it
belongs to, with an explicit story `title` in the matching Storybook section.

## Page matrix

`docs/ui-page-matrix.md` lists every route page with the kit pieces it reaches. It is generated
(`node scripts/ui-page-matrix.mjs`) and CI fails if it is stale. A page with an empty Kit column, or one that
re-implements a kit pattern, is drift.

## Drift budget

Zero, unless written down. For any page:

| Aspect                   | Allowed deviation from the reference |
| ------------------------ | ------------------------------------ |
| Typography               | none                                 |
| Colours                  | none (semantic tokens only)          |
| Components               | no bespoke equivalent of a kit part  |
| Spacing, radius          | reference values only                |
| Tables, buttons, dialogs | shared parts only                    |

A deviation is allowed when a comment at the point of use says why, and the PR description names it.

## How it is enforced

| Check             | What it stops                                                                                    | Where                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Architecture lint | layer violations; `Card` and raw tables in pages; bold weights; raw palette colours              | `packages/eslint-config/src/architecture.js`               |
| Design lint       | hand-built controls, literal colours, stylesheets, menu items without icons, filled section CTAs | `packages/eslint-config/src/design.js`                     |
| Provenance test   | a component naming a `composes` entry it does not import                                         | `packages/ui/src/provenance/claims.test.ts`                |
| Vendor check      | hand edits to vendored primitives, ReUI items, blocks                                            | `scripts/check-vendor.mjs`, `packages/ui/vendor.lock.json` |
| Page matrix check | pages drifting from kit vocabulary unnoticed                                                     | `scripts/ui-page-matrix.mjs --check`                       |
| Visual regression | any change that moves pixels on a covered route                                                  | `apps/console/e2e/visual`, workflow `visual.yml`           |
| CODEOWNERS        | unreviewed changes to tokens, kit, baselines, lint                                               | `.github/CODEOWNERS`                                       |

## Working loop

1. Open the reference page. Name its pattern (list, detail, form, settings, dashboard).
2. Pick the shared parts from the vocabulary. If one is missing, stop and open a design change.
3. Implement one state. Take a screenshot. Compare it with the reference.
4. Fix until it matches, add or update the route in `e2e/visual/routes.ts`, record the baseline.
5. Change to a shared part: run the visual suite, review every diff, then merge.

## Obsolete guidance

These no longer apply to visual decisions. They remain only as history.

- Ferry design rules, the teal brand and Inter (`docs/ui-component-plan.md`, `docs/audit/design-review/`).
- ReUI / Flux surface treatment and the surface-lock recipe (`docs/reui-suggestions.md`,
  `docs/product-catalog-component-map.md`, `docs/ui-foundation.md`).
- Any "house style" or `data-slot` override approach.
- The compositions table in `UI_REVAMP.md`. Its architecture rules still apply (no data fetching in UI,
  URL-addressable tabs, loading/empty/error states); its visual rules do not.

## Known gaps

- The sidebar's "What's new" stack (`ShellChangelog`) follows ReUI `app-shell-7` rather than the reference app,
  which has no changelog. See `docs/design-changes/2026-11-03-sidebar-changelog.md`.
- Component-level visual snapshots (Storybook) are not in place yet; only route-level snapshots are.
- Baselines are regression baselines of the console, not pixel comparisons against the reference app. Comparing
  the two directly needs data parity and is a later step.
- Arbitrary `text-[Npx]` sizes are 82 lines across pages and compositions. Many match the reference exactly.
  Named type tokens and a lint rule against new arbitrary sizes are the follow-up.
- Detail pages use two header compositions: `DetailHeader` (plan, feature) and `DetailShell` (add-on, coupon,
  cost sheet, group, price unit, invoice, payment, subscription, credit note). The matrix shows which is which.
  Unify on the reference's `DetailHeader` + `DetailTabs`.

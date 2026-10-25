# Component guardrails

The rule the design review set: a component that has been customized enough that
it is no longer stock should *say so*, the customization should be visible from
the first commit, and future components should ship with their change scope known
upfront. This is how we keep drift visible instead of discovering it at the end.

Visual decisions live in `UI_SOURCE_OF_TRUTH.md`; this file covers how components are labelled and protected.

## 1. Provenance: every product component declares where it came from

Every component in `packages/ui/src/pages/**` and `packages/ui/src/compositions/**`
exports a `provenance({...})` (see `packages/ui/src/provenance/`):

- `source: 'reui'`: straight from the registry, we own none of its markup. List the `registry` items.
- `source: 'composition'`: Flexprice behaviour composed over ReUI parts. List what it `composes`. **This is the default and the preferred way to differ.**
- `source: 'custom'`: built here because ReUI could not express it. Requires a written `reason`. The type forces the reason at authoring time, not at review.

A component that started as a registry item but has been changed is a
**composition**, not a `reui`. Re-labelling it is the signal that it deviated.

## 1b. Pages compose Section / DetailKit parts

Pages compose `Section` and the DetailKit parts (`DetailHeader`, `DetailTabs`,
`Properties`, `SummaryRow`, `SimpleTable`, `ChoiceCards`, `FormDialog`,
`Composer`); they never import the `Card` primitive and never use raw table
primitives. `Section` is the one contained surface (`bg-background flex flex-col
rounded-xl border`, header `border-b px-6 py-4`), and `Card` stays a primitive
for compositions only. Weights top out at `font-medium`, and colours are
semantic tokens only.

## 2. Vendored code is not hand-edited

ReUI primitives and premium blocks are copied source under
`packages/ui/src/components/{primitives,reui,blocks,examples,ui}/**`. They carry a
`// @ts-nocheck: vendored` header (see `scripts/vendor-suppress.mjs`), and the rule is:
**an upstream fix stays a re-install.** Do not hand-patch a vendored file; that silently loses
the upgrade path.

`scripts/check-vendor.mjs` enforces this. It hashes every vendored file against
`packages/ui/vendor.lock.json` and fails CI (the Lint workflow) on any edit, addition or removal.
If a change is intended, run `node scripts/check-vendor.mjs --update` and explain it in the PR; the
lock file is owned by the design-system reviewer (`.github/CODEOWNERS`).

To differ from a vendored item, compose over it with a `compositions/` or `pages/` component. Do
**not** restyle vendored components from the theme: no `[data-slot=...]` overrides in `styles.css`.
That approach was tried and removed (48 rules, see the divergence report); it silently changed every
instance of a primitive, so no component looked stock.

## 3. Changelogs from the start

`packages/ui/CHANGELOG.md` records every material change to the shared UI:
seeded from the beginning of V2, not started at the end. A change that alters a
component's look, API, or provenance gets a line the same commit it lands. This
is what makes "is this still stock base6?" answerable by reading, not archaeology.

Entry shape: `- <date>: <component/area>: <what changed> (<why / provenance shift>)`.

## 4. Guardrails ship with new components

A new shared component lands with, in the same change:
1. its `provenance(...)` export,
2. a Storybook story exercising each state (the story *is* the test: a11y +
   interaction run on it), and
3. a `CHANGELOG.md` line.

If it wraps or deviates from a vendored item, the provenance says `composition`
and names what it composes, so the deviation is declared, not discovered.

## 5. No user-facing customization in v1

Decided in the review. v1 ships one view per surface (tables, not a card/table
toggle), one filter model, no per-user layout knobs. Customization surface is
where drift and support cost hide; we add it deliberately later, not by default.

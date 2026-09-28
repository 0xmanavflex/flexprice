# Component guardrails

The rule the design review set: a component that has been customized enough that
it is no longer stock should *say so*, the customization should be visible from
the first commit, and future components should ship with their change scope known
upfront. This is how we keep drift visible instead of discovering it at the end.

Modelled on Ferry's discipline (a vendor baseline + a CI gate + `data-slot`-only
house rules), adapted to what this repo already has.

## 1. Provenance — every product component declares where it came from

Every component in `packages/ui/src/flexprice/**` and `packages/ui/src/compositions/**`
exports a `provenance({...})` (see `packages/ui/src/provenance/`):

- `source: 'reui'` — straight from the registry, we own none of its markup. List the `registry` items.
- `source: 'composition'` — Flexprice behaviour composed over ReUI parts. List what it `composes`. **This is the default and the preferred way to differ.**
- `source: 'custom'` — built here because ReUI could not express it. Requires a written `reason`. The type forces the reason at authoring time, not at review.

A component that started as a registry item but has been changed is a
**composition**, not a `reui`. Re-labelling it is the signal that it deviated.

## 2. Vendored code is not hand-edited

ReUI primitives and premium blocks are copied source under
`packages/ui/src/components/reui/**`, `packages/ui/src/primitives/**`, and
`packages/ui/src/components/blocks/**`. They carry a `// @ts-nocheck — vendored`
header (see `scripts/vendor-suppress.mjs`), and the rule is: **an upstream fix
stays a re-install.** Do not hand-patch a vendored file — that silently loses the
upgrade path. To differ, compose over it (a `flexprice/` or `compositions/`
component) or use the theme (`styles.css` `data-slot` house rules), never a fork.

House-style that must reach every instance of a vendored primitive (radius,
row borders, shadows) lives in `styles.css` as `data-slot` rules declared after
Tailwind's utilities — the vendor's public targeting contract — so no component
is forked to restyle it.

## 3. Changelogs from the start

`packages/ui/CHANGELOG.md` records every material change to the shared UI —
seeded from the beginning of V2, not started at the end. A change that alters a
component's look, API, or provenance gets a line the same commit it lands. This
is what makes "is this still stock base6?" answerable by reading, not archaeology.

Entry shape: `- <date> — <component/area>: <what changed> (<why / provenance shift>)`.

## 4. Guardrails ship with new components

A new shared component lands with, in the same change:
1. its `provenance(...)` export,
2. a Storybook story exercising each state (the story *is* the test — a11y +
   interaction run on it), and
3. a `CHANGELOG.md` line.

If it wraps or deviates from a vendored item, the provenance says `composition`
and names what it composes, so the deviation is declared, not discovered.

## 5. No user-facing customization in v1

Decided in the review. v1 ships one view per surface (tables, not a card/table
toggle), one filter model, no per-user layout knobs. Customization surface is
where drift and support cost hide; we add it deliberately later, not by default.

## Next (CI enforcement)

A `check-vendor` step (Ferry's `make check-vendor`) that diffs
`packages/ui/src/components/reui/**` + `primitives/**` against a committed
baseline and fails CI on an undocumented edit is the mechanical backstop for §2.
It lands with the CI finish-up (see the roadmap) so the guardrail is enforced,
not just written down.

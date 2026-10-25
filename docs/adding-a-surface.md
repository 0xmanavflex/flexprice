# Adding a surface

How to build a new screen in the console: a list, an editor, or both: by
composing the pieces that already exist rather than hand-rolling one. This is
the path that keeps V2 from becoming V1, where every screen reached for a
component, customised it locally, and broke on the next change.

**The one rule under all the others:** you compose from the app's own
components (`@fp/ui/*`, `@fp/query`), and you never edit a vendored ReUI file.
ESLint enforces both: a page that imports the SDK, or a component that reaches
for the raw data grid, fails the build with a message telling you what to do
instead. See `packages/eslint-config/src/architecture.js`.

---

## The layers

```
        Pages (apps/console)
        /       |        \
      @fp/ui  @fp/actions  @fp/query      ← peers; a page is where they meet
        \       |        /
              @fp/domain                   ← pure product vocabulary, no React
                  |
            @flexprice/sdk
```

- **`@fp/domain`**: the read model and the zod schema for a thing. Pure
  functions, no React, no transport. `Coupon`, `CouponQuery`, `createAddonSchema`.
- **`@fp/query`**: the only data door. Maps the SDK wire shape to a domain
  model, and exposes hooks (`useCoupons`, `useCreateAddon`). A component never
  fetches.
- **`@fp/ui`**: presentation. Takes domain types as props and renders; it does
  not fetch and cannot name a transport type. `CouponGrid`, `AddonForm`.
- **`apps/console`**: the page wires a query hook to a UI component, and owns
  the URL and any local editor state.

---

## Recipe: a list surface

Copy the **Coupons** slice: it is the smallest complete one. Nine files, each
mirroring an existing sibling:

1. **`packages/domain/src/<thing>.ts`**: the read model, the status/sort enums
   and their labels, `<Thing>Query`, and `DEFAULT_<THING>_QUERY`. Export it from
   `domain/src/index.ts`.
2. **`packages/query/src/keys.ts`**: add a `<thing>s` key factory.
3. **`packages/query/src/<thing>s.ts`**: the `<Thing>Wire` interface, `to<Thing>`
   (wire → domain), `to<Thing>Filter`, `fetch<Thing>s`, and the `use<Thing>s`
   hook. Export from `query/src/index.ts`. Confirm the real SDK method and model
   first (`node_modules/@flexprice/sdk/esm/sdk/<thing>s.d.ts`): do not guess the
   wire shape.
4. **`packages/query/src/<thing>s.test.ts`**: test the mapper's interesting
   branches (a discount → `Money`, an unknown enum → a safe default).
5. **`packages/ui/src/pages/<area>/<thing>s/<Thing>Grid.tsx`**: the table/cards grid,
   in the folder of the sidebar area it lives under (Coupons are
   `pages/settings/discounts/`; see `packages/ui/src/README.md`). This
   is the seam that may import `@ui/components/reui/data-grid`; a page never
   does. Reuse `CatalogStatusBadge`, `Money`, `GridToolbar`, `SortMenu`,
   `GridFooter`, `useViewportPageSize`.
6. **`<thing>Fixtures.ts`** + **`<Thing>Grid.stories.tsx`** beside the grid:
   hand-authored domain fixtures for the story, and the story with a `play`
   assertion. Give it an explicit title under its nav area
   (`App/Settings/Discounts/Discount table`) and add it to the `storySort` order
   in `packages/ui/.storybook/preview.ts`. Export from `pages/index.ts`.
7. **`apps/console/src/app/<thing>Search.ts`** (+ `.test.ts`): the URL codec, so
   a filtered list is a shareable link and a hand-edited URL degrades to page one
   rather than throwing.
8. **`apps/console/src/pages/<thing>s/<Thing>ListPage.tsx`**: the wiring layer:
   call `use<Thing>s`, turn an error into a sentence, hand the grid plain props.
   No `useState` for the query: it lives in the URL.
9. **`apps/console/src/app/router.tsx`**: add the route with `validateSearch`
   and `stripSearchParams(DEFAULT_<THING>_QUERY)`; delete its row from
   `placeholderRoutes.ts`, and add its path to `BUILT` in
   `shell/navigation.test.ts` (the drift guard fails until you do).

---

## Recipe: an editor

Copy the **Add-on** editor (`AddonForm` + `AddonEditorSheet`). An editor is a
drawer over the list, not a page: the list stays visible behind it.

1. **`packages/domain/src/<thing>.ts`**: add `create<Thing>Schema` (zod),
   `Create<Thing>` (`z.infer`), and `empty<Thing>()`.
2. **`packages/query/src/<thing>s.ts`**: add `to<Create/Update>Request`,
   `useCreate<Thing>`, `useUpdate<Thing>` (each mutation invalidates
   `queryKeys.<thing>s.all()`).
3. **`packages/ui/src/pages/<area>/<thing>s/<Thing>Form.tsx`**: RHF + `standardSchemaResolver`
   over the domain schema, `Field` for each control, actions pinned to a footer
   (`mt-auto … border-t`). Presentational: emits a validated `Create<Thing>`,
   holds no other state.
4. **`packages/ui/src/pages/<area>/<thing>s/<Thing>EditorSheet.tsx`**: the form in a `Sheet`,
   keyed per record so opening a second one resets the fields.
5. **The list page** owns the drawer: an `editing` state, the mutations, a
   submit that calls create/update and closes on success. Add a mock handler in
   `apps/console/src/mocks/handlers.ts` that echoes the record back so the
   success path runs end to end.

---

## What not to do

- **Do not edit anything under `packages/ui/src/components/**` or
  `primitives/**`.** It is vendored from the ReUI registry; an upstream fix stays
  a re-install (`pnpm ui:add <item>`). Wrong for us → compose around it in
  `pages/` or `compositions/`, and record why in the component's provenance.
- **Do not import a block-grade primitive** (`data-grid`, `filters`, `cascader`)
  from a page or a new composition. Compose from `FeatureGrid`, `PlanGrid`,
  `FilterBar`. ESLint refuses it.
- **Do not fetch in a component.** Loading, empty and error are props; the page
  passes them down. That is what keeps the component renderable in a story.
- **Do not name a colour.** Use the tokens: `text-muted-foreground`,
  `bg-brand`, `CatalogStatusBadge`. The one brand hue lives in three `--brand`
  lines in `packages/ui/src/styles.css`; nothing else names a colour, which is
  what lets the whole app be rebranded from one place.

---

## Before you push

```bash
pnpm run typecheck   # tsc -b across every project
pnpm run lint        # includes the architecture boundaries
pnpm run test        # unit + Storybook interaction tests
pnpm run build
```

`pnpm run verify` runs all four. Keep the surface a small, reviewable commit:
one screen, its slice, its tests.

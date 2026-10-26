# Design rules

The short, binding list for anyone (person or agent) building UI in this repo. If a page you are writing
breaks one of these, the page is wrong. Background and the reasons live in `UI_SOURCE_OF_TRUTH.md`; this file is
what to do. Rules marked **(lint)** fail `pnpm lint`; the rest are checked in review.

## Before you write a line

1. Name the pattern: **list**, **detail**, **form**, **settings** or **dashboard**.
2. Open the closest existing screen of that pattern (table below) and copy its structure. New screens are
   configuration of existing parts, not new visual design.
3. If no kit part fits, stop and ask. A missing part is a design decision (`DESIGN_CHANGE.md`), not a licence to
   build one in the page.

| You are building             | Copy this                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- |
| A list page with row menus   | `packages/ui/src/pages/settings/taxes/TaxRateGrid.tsx` (`EntityList` + `cells`)   |
| A section on a detail page   | `packages/ui/src/pages/customers/CustomerTaxSection.tsx` (`Section` + header CTA) |
| A detail header and its menu | `packages/ui/src/pages/customers/CustomerDetail.tsx` (`DetailMoreMenu` items)     |
| A short create/edit          | `FormDialog` + `Field` (`compositions/forms`), e.g. the tax-rate dialog above     |
| A destructive confirm        | `ConfirmDialog` (`compositions/feedback/ConfirmDialog.tsx`)                       |

## 1. Use kit components, never hand-built markup

| Need                     | Use                                                              | Not                                       |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| Page title + main action | `PageHeader` (`compositions/layout/Page.tsx`)                    | an `<h1>` and a flex row                  |
| Titled surface           | `Section` (`compositions/layout/Section.tsx`)                    | `Card`, a bordered `<div>` **(lint)**     |
| List / table             | `EntityList` + `cells` (lists), `SimpleTable` (in a Section)     | `<table>`, the table primitive **(lint)** |
| Key / value fields       | `Properties`, `SummaryRow` (`compositions/detail/DetailKit.tsx`) | a hand-rolled `<dl>` grid                 |
| Buttons                  | `Button` (`@ui/components/primitives/button`)                    | `<button>` **(lint)**                     |
| Inputs                   | `Field` + primitive `Input` / `Textarea` / `OptionSelect`        | `<input>`, `<select>` **(lint)**          |
| Empty                    | `SectionEmpty` (in a Section), `EntityList`'s `empty` (lists)    | a centred `<p>`                           |
| Status                   | `pillColumn` / `StatusBadge` (`pages/shared`)                    | a coloured `<span>`                       |
| Icons                    | `@ui/icons` (`@fp/ui/icons` from the app)                        | `lucide-react` **(lint)**                 |

Do not create per-entity copies of a kit part (`RefundCard`, `NotesTable`): pass data to the kit part.
`pages/shared/` and `compositions/` are the kit; only they may build from raw elements.

## 2. Actions: one place, one hierarchy

- **Filled (`<Button>`, default variant) is only for the page's one main create action**: `PageHeader action`
  or `EntityList primaryAction`, top right. One per view. Lead with `<PlusIcon aria-hidden />`.
- **Everything else is `variant="outline"`** (or `ghost` for icon-only triggers). A section's add/edit button is
  outline. **(lint: a filled Button in a `Section` action fails)**
- **A section's CTA lives only in the `Section` header, top right** (`action` / `actions`), in every state:
  empty, loading and populated. It never moves into the empty body, and an empty state never repeats it.
  `SectionEmpty` and a list's `empty` carry the message (and at most a non-create link such as "Read docs" or
  "Try again"), never a second create button.
- Section header buttons match `CustomerTaxSection`: outline, `h-8`, leading icon. Do not invent sizes.
- Every other record action goes in the overflow menu (`DetailMoreMenu` on a detail header, `rowActions` on a
  list), destructive items last.

```tsx
// Do
<Section table title="Notes" action={
  <Button variant="outline" size="sm" className="h-8 px-3" onClick={add}>
    <PlusIcon aria-hidden /> Add note
  </Button>
}>
  {notes.length === 0 ? <SectionEmpty title="No notes yet" /> : <SimpleTable … />}
</Section>

// Don't: filled button in a section, CTA that moves into the empty body
<Section title="Notes" actions={notes.length ? <Button onClick={add}>Add</Button> : undefined}>
  {notes.length === 0 ? <SectionEmpty title="No notes" action={<Button onClick={add}>Add note</Button>} /> : …}
</Section>
```

## 3. Every menu item has an icon **(lint)**

Every `rowActions` item (`EntityRowAction`), `DetailMoreMenu` item and `RowActionsMenu` extra item has an
`icon` from `@ui/icons`: `PencilIcon` edit, `CopyIcon` copy, `EyeIcon`/entity icon view, `Trash2Icon` delete.
Destructive items set `destructive: true`; read-only ones (view, copy) set `readOnly: true`.

```tsx
// Do
{ label: 'Copy refund ID', icon: <CopyIcon aria-hidden className="size-4" />, readOnly: true, onSelect: copy }
// Don't
{ label: 'Copy refund ID', onSelect: copy }
```

## 4. No custom CSS, no new colours **(lint)**

- No `.css` files or stylesheet imports outside `packages/ui/src/styles.css`, no `<style>` tags.
- No hex, `rgb()`, `oklch()` or arbitrary colour classes (`bg-[#0f2a3d]`). No raw palette classes
  (`text-red-600`). Use tokens: `text-muted-foreground`, `bg-muted`, `border`, `text-primary`, `text-success`,
  `text-warning`, `text-destructive`.
- No new theme, colour scheme or `[data-slot=…]` override. Chart series colours come from `pages/shared/charts`.
- Do not restyle kit components through `className` to make them look different (new borders, shadows,
  backgrounds, radii). Layout classes (`gap-*`, `flex`, widths) are fine.

## 5. Typography **(lint)**

`font-medium` is the heaviest weight: no `font-semibold` / `font-bold`. Sizes: `text-xs`, `text-sm`,
`text-[13px]` (descriptions), as the kit already uses them. Section titles come from `Section`; do not add your
own heading styles.

## 6. Design references are references

A design zip, Figma frame or screenshot shows **intent**, not markup to copy. Map each region to the kit part
above and rebuild it from kit parts. Never paste its HTML/CSS, its colours, its fonts or its spacing values; if
the reference shows something the kit cannot express, ask (design change) rather than approximating it in a
page.

## 7. Before you say it's done

- `pnpm lint` and `pnpm typecheck` pass (`--max-warnings 0`).
- A new page or part has a story in its folder (`<Thing>Page.stories.tsx` for a full page).
- You did not add a component that duplicates a kit part, a CSS file, or a colour.
- If you intentionally deviate, the line has a comment saying why, and the PR names it.

## Exceptions

`packages/eslint-config/src/design.js` lists files that broke a rule before it existed (`LEGACY`). That list only
shrinks. A new, justified exception is `// eslint-disable-next-line design/<rule> -- why` at the point of use.

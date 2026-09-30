# Forms and editing

One pattern for every create and edit flow, built from stock ReUI/shadcn primitives.

## Create

A centred dialog: `FormDialog` (`packages/ui/src/compositions/FormDialog.tsx`, sizes `sm`/`md`/`lg`).

- Form state: react-hook-form with `standardSchemaResolver` over the zod schema in `@fp/domain`.
- Fields: `Field` (render-prop over the stock `field` primitive), `OptionSelect`, `OptionCombobox`, `DateInput`, stock `Input`/`Textarea`/`Switch`.
- Footer: `FormActions` with `mode="create" | "edit"`; it renders the submit error alert.
- The `*EditorDialog` wrapper keys the form on the record so RHF defaults reset between opens.
- No sheets, drawers or sidebars.

## Edit

- **Simple fields are edited inline in the table.** `textColumn(id, header, get, { onEdit })` renders a click-to-edit cell: Enter or blur saves, Escape cancels, clicks never reach the row. Grids expose `onRename`, list pages wire it to the update mutation.
- **Heavier edits reuse the same dialog** in `mode="edit"`, prefilled, opened from the row menu (`RowActionsMenu`). Charges, entitlements, credit grants, features, customers, tax rates and cost sheets work this way.
- Charges are versioned: an edit sends `effective_from` and creates a new price version.

## API limits that shape the UI

- Groups have no update route: create and delete only.
- The SDK cannot send `null`, so clearing an optional field (an entitlement's limit, a feature's group) cannot be done through update.
- Meters are created through the feature and are immutable afterwards.

## Tests

- Stories (`*.stories.tsx`) are the browser and a11y tests for each dialog.
- Mocked Playwright specs in `apps/console/e2e/*.spec.ts` create then edit each entity.
- `apps/console/e2e/live-flows.spec.ts` is opt-in (`E2E_LIVE=1`) and drives the real API. Run it only against a dedicated development environment, never a shared or production one.

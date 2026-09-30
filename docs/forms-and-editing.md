# Forms and editing

Create and edit are pages, not modals. Pick the pattern by the size of the change:

| Scenario | Pattern | Building block |
| --- | --- | --- |
| Simple value (name, description) | Inline edit where the value is shown | `InlineField` |
| Small contextual action (clone, delete, confirm) | Small dialog | existing dialogs |
| Major resource creation | Dedicated full page | `FormPage` |
| Long creation journey | Full-page stepper | `useFormSteps` + `FormSteps` + `StepFooter` |
| Complex edit | Dedicated edit page, same form prepopulated | same form, `unlockAll` |
| Nested creation from a detail page | Form inside that section | `ContextualSection` |

## Routes

Top level: `LIST -> /x/new (?step=) -> detail`. Edit: `/x/$id/edit` (`?step=`). The step lives in the URL so a half-finished flow is a link and Back works. Cancel returns to where the person came from.

## Rules

- One react-hook-form per stepped flow, owned by the concrete form component; `useFormSteps` holds only step state and validates a step with `form.trigger(fields)` before Next.
- Edit is the same form as create: same steps, every step reachable, Save on every step.
- Nested creation (plan charges, entitlements, credit grants; customer subscriptions) swaps the section's table for the form, keeps the parent tab, and refetches the table on success. Cancel restores the table.
- The data layer (`@fp/query` hooks, `@fp/domain` schemas) is shared with the old dialogs; only the interaction model changed.
- Components: FeatureForm is the reference implementation.

## API limits that shape the UI that shape the UI

- Groups have no update route: create and delete only.
- The SDK cannot send `null`, so clearing an optional field (an entitlement's limit, a feature's group) cannot be done through update.
- Meters are created through the feature and are immutable afterwards.

## Tests

- Stories (`*.stories.tsx`) are the browser and a11y tests for each form.
- Mocked Playwright specs in `apps/console/e2e/*.spec.ts` drive the create and edit pages.
- `apps/console/e2e/live-flows.spec.ts` is opt-in (`E2E_LIVE=1`) and drives the real API. Run it only against a dedicated development environment, never a shared or production one.

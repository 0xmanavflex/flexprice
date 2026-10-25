# The V2 UI foundation

> **Superseded for visual decisions.** What the console looks like is defined by `UI_SOURCE_OF_TRUTH.md` (the reference app, Geist, navy primary). This document is kept as history; where it disagrees, that file wins.

The architecture proofs answered "does the data flow hold?". This answers a
different question, and one they did not touch: **what does a Flexprice V2
interface actually look like?**

Migrations pause until this exists. Otherwise V2 becomes a technically sound
architecture with V1's component system quietly rebuilt on top of it.

## The rule

> **ReUI is the default implementation source for generic UI.**

```
Need a component
      │
      ├─ Does ReUI provide it? ──────── yes ──> use it            provenance: REUI
      │
      ├─ Can it be composed from ReUI? ─ yes ──> compose          provenance: COMPOSITION
      │
      └─ Neither ────────────────────────────> custom, with a
                                                stated reason     provenance: CUSTOM
```

`CUSTOM` requires its `reason` **in the type**, so nothing can be quietly
custom. That is the enforcement, not the diagram.

**No V2 component introduces another UI foundation.** The stack is fixed:

```
ReUI  ->  Base UI  ->  Tailwind  ->  Flexprice tokens
```

V1's Radix components stay untouched during migration. They are not ours to
fix, and mixing a second primitive library is how a design system dies.

## What exists

Deliberately a small representative set: enough vocabulary to build real
screens, not a catalogue of everything the registry offers. 30 vendored files
is already the point at which "reuse before you build" stops being checkable.

**Primitives**: vendored from ReUI, never hand-edited:
`avatar` · `button` · `card` · `checkbox` · `dialog` · `dropdown-menu` ·
`input` · `label` · `popover` · `radio-group` · `select` · `separator` ·
`skeleton` · `spinner` · `tabs` · `tooltip`, plus ReUI's own `badge`,
`data-grid` and `stepper`.

**Compositions**: generic behaviour over ReUI parts, knowing nothing about
billing:

| | What it owns |
|---|---|
| `Field` | label/control/hint/error association, including `aria-describedby` reaching **both** hint and error |
| `Section` | a region labelled by a real heading, with a scoped action slot |
| `EmptyState` | distinguishes "none yet" from "none matching": different situations, different offers |
| `Toolbar` | controlled search + filter landmark for list surfaces |
| `WorkflowStepper` | ReUI's stepper re-addressed by stable id, for URL-safe workflow state |

**Flexprice**: components that speak billing:

| | Why it is not generic |
|---|---|
| `Money` | takes a domain `Money`; cannot be handed a number that has been through a float |
| `Metric` | direction and sentiment are **separate** inputs: up is good for revenue, bad for failed payments |
| `InvoiceStatusBadge` | one place mapping domain statuses to accessible variants |
| `UsageMeter` | models unlimited, over-limit and zero-allowance, which no generic progress bar does |

## The showcase

Storybook is the visual contract. It is not a second artifact that can drift:
the same story file is the workbench, a browser test and an accessibility
check.

```
Start here                   what the tree is and where files live
Design system/*              tokens and the page map          src/design-system/
Building blocks/<group>/*    generic parts and billing        src/compositions/<group>/,
                             vocabulary (Money, Metric, …)    src/pages/shared/
App/<nav area>/<entity>/*    real product screens, full page  src/pages/<area>/<entity>/
                             first, then its parts
```

The Building blocks groups are Layout, Forms, Tables & lists, Detail pages,
Feedback & states, Charts & metrics and Shell. The App folders follow the
console sidebar (`apps/console/src/app/shell/navigation.ts`). See
`packages/ui/src/README.md` for the full map.

```bash
pnpm --filter @fp/ui storybook        # the workbench, on :6006
pnpm --filter @fp/ui test:stories     # every story, in a real browser, with a11y
```

75 story tests across 13 files. Every one renders from domain fixtures with
**no QueryClient, no SDK, no API mocks, no providers and no network**: the
property that makes `@fp/ui` presentational in fact rather than by convention.

## Two accessibility defects the gate caught

Neither was visible by eye, and both would have shipped.

1. **Solid badges fail WCAG AA.** White on `success` measured 2.47:1 and on
   `info` 4.4:1, against a 4.5:1 threshold. The `-light` variants clear it
   comfortably and are the right density for a table anyway.
2. **`text-success` fails as a foreground.** It is a background-tuned green.
   There is no text-on-card success token, and adding one would breach the
   no-new-tokens rule: so `Metric` renders its change as a tinted badge,
   reusing variants already validated.

A third, in ReUI itself: its `Stepper` declares `role="tablist"` with no
`role="tab"` children. Fixed by composing around it: worth reporting upstream.

## What "migrated" should mean from here

With this in place, a migration can answer the stronger question:

> Did we migrate Features to the new Flexprice **UI system**?

rather than only:

> Did we move Features to the new architecture?

The Features surface currently answers the second. Bringing it onto `Toolbar`,
`EmptyState` and `Section` is the first task when migrations resume.

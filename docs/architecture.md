# V2 architecture

## The principle

Do not invent a second frontend architecture. Promote the architectural
contracts already validated in Watchtower V2, and adapt the *implementation* to
Flexprice's stack and migration constraints.

Watchtower V2 is a reference implementation, not a template to duplicate
line-for-line. Its Base UI / Tailwind v4 / React Compiler / Nx choices are
evaluated separately from its architectural principles: the Flexprice dashboard
that actually has to migrate is React + Radix + Tailwind v3, and that is a real
constraint, not an inconvenience.

The goal is not "make Flexprice look like Watchtower's repository". It is
"make Flexprice follow the architectural contracts Watchtower has proven", so
there is one platform direction instead of a third frontend philosophy.

## The layers

`actions` is not *under* `query`. Both are application-facing peers over the
domain:

```
              Pages
            /   |   \
          UI  Actions  Query
            \   |   /
             Domain
                |
         @flexprice/sdk
                |
             Backend
```

The constraint matrix, enforced by `@fp/eslint-config` and proved by 23 tests
that lint a file at each path:

```
UI        ✕ → query        ✕ → SDK      ✕ → backend DTOs   ✕ → actions
Actions   ✓ → domain       ✓ → query    ✕ → SDK            ✕ → UI
Query     ✓ → SDK          ✓ → domain   ✕ → UI             ✕ → actions
Domain    ✕ → React        ✕ → UI       ✕ → query          ✕ → SDK
Apps      ✓ → UI, actions, query, domain                   ✕ → SDK, @fp/api
```

**UI may not reach the query layer at all.** That is stronger than "UI may use
the application layer", and deliberate: a component that cannot fetch renders in
a story, tests without a network, and survives the API changing shape. Loading,
empty and error become props rather than states you must provoke a server into
producing. Pages do the wiring; that is what a page is for.

A component receiving a `WalletResponse` is the bug this prevents. Flexprice
transport vocabulary stops at the domain layer.

## The packages

| Package | Holds | Depends on |
|---|---|---|
| `@fp/api` | SDK client construction, browser auth, one error shape | `@flexprice/sdk` |
| `@fp/query` | TanStack Query, query keys: **the only data door** | `@fp/api`, `@fp/domain` |
| `@fp/domain` | Product vocabulary; transport types stop here |: |
| `@fp/actions` | Product capabilities, declared once |: (nothing) |
| `@fp/ui` | ReUI primitives + Flexprice compositions |: |
| `@fp/sdk-adapter` | **Temporary.** Contract gaps, with removal issues | `@fp/api` |

## Decision: `actions` is a seam, not a platform

`packages/actions` is kept, and kept thin.

The V1 dashboard already carries an LLM pricing orchestrator (`src/api/ai/`) and
a WebMCP stub (`src/agent/webmcp.ts`), so "agentic" is a real direction rather
than a speculative one. But speculative agent infrastructure does not get to
shape the frontend architecture.

The distinction that keeps it honest: **`actions` describes what the product can
do, not how the UI talks to the backend.** `createPlan()`, `grantCredits()`,
`changeSubscription()`, `updateBudget()`: each declared once with its input
schema, required permissions and risk level, then reachable from a button, the
command palette, or an agent through the same gate.

Two constraints hold it to a seam:

1. **The core UI does not depend on it.** A button may invoke an action, but
   components, pages and the design system build and render without the package.
   No component becomes AI-aware.
2. **It calls nothing.** No dependency on `@fp/query`, `@fp/api` or the SDK:
   an action's `run` is supplied by the app that registers it. The layering
   above is therefore a fact, not a convention.

What is explicitly out of scope until a real consumer asks: an agent runtime,
prompt handling, planning, a chat surface. The value today is that a capability
is declared once and reachable by a person and an agent through one permission
check: not that an agent platform has been built.

What is already enforced, with tests:

- an agent gets no more than the user it acts for; there is one `invoke()`
- sensitive actions (destructive, financial, customer-visible) require explicit
  confirmation of *that* invocation: approval never carries to the next call
- permission is checked before confirmation is requested
- the palette and the agent are shown the identical capability set
- a WebMCP call routes back through the same gates rather than around them

## Decision: the contract gap is fixed upstream

~109 of the backend's 320 handlers carry no swagger annotation. V2 targets the
*corrected* contract rather than compensating for today's document. Phasing,
evidence and the fallback are in [`api-contract-gap.md`](api-contract-gap.md).

## What is enforced, not documented

Rules that live only in prose are not rules. The V1 repo's `AGENTS.md` forbids
`any`; there are 73. It says tests are co-located; coverage is ~12% of files.

| Rule | Enforced by |
|---|---|
| UI may not import API clients, services or DTOs | ESLint import boundaries |
| Layer direction is one-way | ESLint import boundaries |
| Component provenance (ReUI / composition / custom) | TypeScript: `custom` requires a `reason` |
| A shim has a removal issue | `shims.test.ts` |
| Component states exist | Storybook story = browser test + a11y test |
| Type safety | `tsc`, no `any` |
| Everything above | `pnpm verify` in CI, same commands locally |

## Decision: money never becomes a float

Found while building `@fp/domain`, and worth stating as a rule rather than a
detail.

The backend serializes monetary amounts as decimal **strings**: the SDK types
`amountDue`, `amountPaid`, `total` and the rest as `string | undefined`:
specifically so precision survives the wire. The V1 dashboard calls
`parseFloat` **101 times**, converting those exact decimals into IEEE-754
doubles, and separately declares `decimal.js` as a dependency that no file
imports.

The cost is demonstrable, not theoretical:

```
Intl.format('12345678901234567.89')       ->  $12,345,678,901,234,567.89
Intl.format(Number(same string))          ->  $12,345,678,901,234,568.00
```

`@fp/domain` therefore carries a `Money` type that keeps the exact string,
pairs it with its currency, formats through `Intl.NumberFormat` (which accepts
a string and formats the exact decimal), and compares digit by digit. No
dependency required: `Money` is ~90 lines and pure.

Two deliberate absences:

- **No arithmetic.** Totals, tax, proration and discounts are the backend's
  answer. A UI that recomputes them will eventually disagree with the invoice
  the customer was charged, and the UI will be wrong. A sum the API does not
  send is an API gap, not a reason to add `addMoney`.
- **No implicit currency.** `compareMoney` throws on mismatched currencies
  rather than returning an answer to a question that has none.

The rule for migration: a `parseFloat` on an API amount is a bug, and there are
101 of them to retire.

## Final decisions

| | |
|---|---|
| **Base library** | `base-nova` (Base UI) for all new V2/ReUI work. Existing Radix components keep working through the migration. |
| **Block surface** | **Card** by default. Frame only where there is an explicit layout reason, stated. |
| **`@fp/ui`** | Stays thin: `primitives/`, `compositions/`, `flexprice/`, `provenance/`. V1 reached 616 component files, 371 in one `molecules/` folder. Thin is the feature. |

### The migration rule

> **V2 architecture applies to new code immediately. Migrating V1 is
> opportunistic, not a prerequisite.**

This is the rule that stops the team spending months "finishing the migration"
before shipping anything. V1 surfaces move when they are touched for another
reason: not on a schedule, and not as a gate.

### The three proofs

Scale on evidence, not on an architectural opinion. If these three feel good,
the foundation is right:

| Migration | Validates |
|---|---|
| **Data Grid** | ReUI + TanStack, filtering/sorting, dense billing data: against 55 hand-rolled tables |
| **Subscription / Price form** | RHF + Zod, complex validation and state: against 1,036 `useState`s and a 1,281-line form |
| **Billing Overview** | Compositions, the Card surface, domain vocabulary end to end |

### Sequence

```
ReUI setup                       done
base-nova + Card defaults        done
architecture ESLint rules        done
query + domain                   done
@fp/ui                           scaffolded, empty
Data Grid
Complex Form
Billing Overview
Storybook / a11y / Playwright enforcement
Migrate V1 surfaces as they are touched
```

## Decision: complex workflows are pages, not modals

New multi-field or multi-step creation and edit flows get a dedicated route and
a stepper. Modals are reserved for lightweight, self-contained interactions:
confirmation, a quick action, a genuinely small form.

**Prefer a stepper whenever a form has meaningful sequencing, or touches more
than one conceptual domain.** That is the test, and it is deliberately a
principle rather than a size limit: without one, the answer is eventually
"this can fit in a drawer", and it never can.

Why it matters, concretely: a modal has no room for validation summaries, no
review step, no browser history, and no URL. V1's `PriceOverrideDialog.tsx` is
**807 lines** inside a dialog, and `SubscriptionForm.tsx` is **1,281 lines**:
neither can be linked to, resumed, or navigated back out of.

### The shape a stepper takes

```
Page / Route
      ↓
Stepper / form orchestration     owns step state, in the URL
      ↓
Individual step                  presentational, like InvoiceGrid
      ↓
Domain model
      ↓
Actions
      ↓
SDK
```

The step components stay presentational. A step receives its values and emits
changes; it does not fetch, does not know which step number it is, and does not
decide what happens next. That is orchestration, and it belongs to the route:
for exactly the reason the grid does not own its own query.

Applied to subscriptions, the eventual shape is Customer → Plan → Prices →
Entitlements → Credits → Review. That is not the next piece of work: the
reusable pattern gets established on one dense step first, so form architecture
is not conflated with multi-step routing.

## Decision: who owns what in a workflow

Two rules, both aimed at the same failure: a stepper that grows into an
application.

> **The Stepper owns presentation, not workflow state.** Step state belongs to
> the page/route, so flows stay deep-linkable, testable, and navigable with
> browser history.

> **A form step owns its domain value, not the entire wizard.** Steps
> communicate validated domain values upward; the wizard composes them.

This is the same separation the invoice grid already demonstrates: the grid
does not own its query, and the stepper does not own its position. In both
cases the route does, because the route is the thing with a URL.

```
Stepper        presentation
Page / Route   workflow + URL state
Step           form state + validation
Domain         business invariants
Actions        mutations / capabilities
Query          reads
SDK            transport contract
```

### Sequencing note

Phase 0 does not gate this. The missing swagger annotations are a
transport-contract problem; workflow composition is a UI-architecture problem,
and the two can proceed in parallel. Backend owns the annotation epic; the
console proves the composition meanwhile.

The milestone is **"prove the workflow composition"**: a stepper, one real
step, and step state in the URL: not "build the subscription wizard". The
remaining five steps are placeholders until the architecture is shown to hold.

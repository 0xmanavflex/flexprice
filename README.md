# Flexprice Console — V2

A rebuild of the Flexprice dashboard frontend. Not a restyle, and not a
rewrite: a set of boundaries that make a class of bug impossible, proved on
real surfaces before being proposed as a standard.

**Status:** architecture frozen. One surface migrated. Awaiting human review.

| | |
|---|---:|
| Tests | **310** |
| Story tests (real Chromium + a11y) | 75 |
| Packages | 7 + 1 app |
| Hand-written API/DTO code | **0** |
| Compatibility shims | **0** |
| Lint at `--max-warnings 0` | clean |

---

## Table of contents

1. [Why V2 exists](#1-why-v2-exists)
2. [What V2 changes](#2-what-v2-changes)
3. [The architecture](#3-the-architecture)
4. [The packages](#4-the-packages)
5. [What is enforced, not documented](#5-what-is-enforced-not-documented)
6. [The UI foundation](#6-the-ui-foundation)
7. [Testing](#7-testing)
8. [Agentic-first, concretely](#8-agentic-first-concretely)
9. [What was proved, and how](#9-what-was-proved-and-how)
10. [Bugs found on the way](#10-bugs-found-on-the-way)
11. [The backend dependency](#11-the-backend-dependency)
12. [Migration strategy](#12-migration-strategy)
13. [Getting started](#13-getting-started)
14. [Open decisions](#14-open-decisions)

---

## 1. Why V2 exists

The existing dashboard (`flexprice/flexprice-front`) is **1,237 files and
141,886 lines**. It works. The problem is not its size — it is four structural
properties that make every future change more expensive than the last.

### 1.1 The contract is maintained by hand, twice

The backend publishes an OpenAPI document: **225 paths, 271 operations, 570
schemas**. Speakeasy generates Go, Python and TypeScript SDKs and an MCP server
from it. `@flexprice/sdk` is on npm.

The dashboard imports it **zero times**. Instead it hand-maintains:

- **47 API classes** — 5,763 lines
- **53 DTO files** — 7,473 lines

**13,236 lines duplicating a document that already generates four clients.**
Every backend field rename is a silent drift until something 400s in
production. There is no mechanism that would notice.

It is already drifting. `CustomerApi.getCustomers()` calls `GET /customers`;
the spec gives `/customers` only `put` and `post`. That call works, and nothing
told anyone it was outside the contract.

### 1.2 Forms and tables are hand-rolled — in a product that is mostly forms and tables

| | |
|---:|---|
| **0** | files using `react-hook-form` |
| **1,036** | `useState` calls in `.tsx` files |
| **55** | hand-rolled `*Table*.tsx` components |
| **1,281** | lines in `SubscriptionForm.tsx` |
| **1,106** | lines in `AddFeature.tsx` |
| **807** | lines in `PriceOverrideDialog.tsx` |

In a billing product the forms **are** the product — subscriptions, price
overrides, entitlements, credit grants. Each of those files is a bespoke state
machine whose validation rules exist only while it is mounted.

### 1.3 Money goes through floats

The backend serialises monetary amounts as decimal **strings** — the SDK types
`amountDue`, `amountPaid`, `total` and the rest as `string | undefined` —
specifically so precision survives the wire.

The dashboard calls `parseFloat` on them **101 times**. It also declares
`decimal.js` as a dependency that **no file imports**.

```
Intl.format('12345678901234567.89')   ->  $12,345,678,901,234,567.89
Intl.format(Number(same string))      ->  $12,345,678,901,234,568.00
```

### 1.4 The rules are prose, so they are not rules

`AGENTS.md` forbids `any`. There are **73**. It says tests are co-located;
**147** test-or-story files cover **1,237** source files — about 12%.

A rule no tool checks is a preference, and preferences lose to deadlines.

---

## 2. What V2 changes

| | V1 | V2 |
|---|---|---|
| API contract | 47 hand-written classes + 53 DTO files | `@flexprice/sdk`, generated |
| Drift detection | none | the contract *is* the types |
| Data access | components call `axios` | one enforced door |
| Forms | `useState` machines | RHF + domain Zod schemas |
| Validation rules | inside components | in the domain, reusable |
| Tables | 55 hand-rolled | ReUI `data-grid` (TanStack v9) |
| Money | `parseFloat` × 101 | exact decimal strings, no arithmetic |
| Complex flows | modals | pages + stepper, state in the URL |
| Filter/sort state | component state | typed URL search params |
| Component states | untested | story = browser test + a11y test |
| Architecture rules | prose in `AGENTS.md` | **ESLint errors** |
| UI primitives | Radix + shadcn, hand-edited | ReUI on Base UI, vendored |
| Agent surface | one stub tool | capability registry |

### What V2 is *not*

- **Not a rewrite.** 141,886 lines will not be rewritten. New code follows V2;
  V1 migrates when touched.
- **Not a new architecture.** It promotes contracts already validated in
  `flexprice/watchtower`, so there is one platform direction rather than a third
  frontend philosophy.
- **Not a copy of Watchtower either.** Its Base UI / Tailwind v4 / Nx choices
  were evaluated separately from its principles.

---

## 3. The architecture

```
              Pages
            /   |   \
          UI  Actions  Query      <- peers, all application-facing
            \   |   /
             Domain
                |
         @flexprice/sdk
                |
             Backend
```

The constraint matrix, enforced by ESLint and proved by 23 tests that lint a
real file at each guarded path:

```
UI        ✕ query   ✕ SDK     ✕ actions   ✕ backend DTOs
Actions   ✓ domain  ✓ query   ✕ SDK       ✕ UI
Query     ✓ SDK     ✓ domain  ✕ UI        ✕ actions
Domain    ✕ React   ✕ UI      ✕ query     ✕ SDK
Apps      ✓ UI, actions, query, domain    ✕ SDK, @fp/api
```

### Why UI may not reach the query layer *at all*

Stronger than "UI may use the application layer", and deliberate.

A component that **cannot** fetch:

- renders in a story, so every state is documentable
- tests without a network, so tests are fast and deterministic
- survives the API changing shape, because it never knew its shape
- makes loading, empty and error **props** rather than states you must provoke
  a server into producing

Pages do the wiring. That is what a page is for.

### Why the domain layer exists

`InvoiceResponse` has **~45 fields, every one optional**, and **three separate
notions of status**:

| Field | Values |
|---|---|
| `status` | entity lifecycle — published, deleted |
| `invoiceStatus` | `DRAFT` `FINALIZED` `VOIDED` `SKIPPED` |
| `paymentStatus` | `PENDING` `SUCCEEDED` `FAILED` `PARTIALLY_REFUNDED` … |

A grid cell cannot reasonably be asked which of the three it means, nor to
write `invoice.amountDue ?? '0'` in every column.

The domain model is narrow and total, with **one** status — including
`overdue`, which **the API does not have**. It is finalized, plus an unpaid
balance, plus a due date in the past: a derivation every screen would otherwise
reinvent slightly differently.

---

## 4. The packages

pnpm + Nx workspace.

```
apps/
  console/          the dashboard
packages/
  api/              SDK client, browser auth, one error shape
  domain/           product vocabulary — pure, dependency-free
  query/            the only data door
  actions/          product capabilities, declared once
  ui/               ReUI primitives, compositions, Flexprice components
  sdk-adapter/      TEMPORARY. Contract gaps. Currently empty.
  eslint-config/    the architecture, as build errors
```

| Package | LOC | Tests | Holds |
|---|---:|---:|---|
| `@fp/api` | 488 | 15 | SDK client, JWT + environment headers, `ApiError` |
| `@fp/domain` | 1,247 | 93 | Money, Invoice, PriceOverride, Feature |
| `@fp/query` | 948 | 37 | query keys, retry policy, mappers, hooks |
| `@fp/actions` | 514 | 16 | capability registry and its bridges |
| `@fp/ui` | 3,097 | 75 | compositions + Flexprice components + stories |
| `@fp/eslint-config` | 120 | 23 | the dependency matrix |
| `@fp/sdk-adapter` | 87 | 3 | shim quarantine — **0 shims** |
| `apps/console` | 925 | 48 | routes, pages, URL codecs |

Plus **12,031 lines vendored from the ReUI registry**, never hand-edited.

### `@fp/api` — why not the SDK's own auth

The published SDK types its security as `{ apiKeyAuth: string }`. **An API key
in a browser bundle is a key served to every visitor.** So `security` is never
populated; the JWT and `X-Environment-ID` go on through an `HTTPClient`
`beforeRequest` hook, read per request so a token refresh needs no remount.

The backend's `.speakeasy/overlays/typescript-auth.yaml` already declares
`BearerAuth` and `EnvironmentId` for exactly this. It is not in the published
`2.1.30` build yet. When it lands, the hook becomes the SDK's typed option.

### `@fp/domain` — money without floats

```ts
interface Money {
  readonly amount: string   // the exact decimal the API sent. Never a number.
  readonly currency: string
}
```

Formats through `Intl.NumberFormat`, which accepts a string and formats the
exact decimal. Compares digit by digit. **~90 lines, zero dependencies.**

Two deliberate absences:

- **No arithmetic.** Totals, tax, proration and discounts are the backend's
  answer. A UI that recomputes them will eventually disagree with the invoice
  the customer was charged, and the UI will be wrong. A sum the API does not
  send is an API gap, not a reason to add `addMoney`.
- **No implicit currency.** `compareMoney` throws on mismatched currencies
  rather than answering a question that has none.

### `@fp/query` — the retry policy the error shape pays for

Because every rejection is an `ApiError` carrying a `kind`, the client can tell
a flaky network from a refusal:

| Kind | Retries |
|---|---|
| `unauthorized` `forbidden` `not_found` `invalid` | **never** — retrying a refusal makes the user wait 3× to be told no |
| `network` `server` | up to 3 |
| **mutations** | **never** — retrying a failed charge is how a customer gets charged twice |

---

## 5. What is enforced, not documented

| Rule | Enforced by |
|---|---|
| UI may not import API clients, services or DTOs | ESLint import boundaries |
| Layer direction is one-way | ESLint import boundaries |
| Component provenance | TypeScript — `custom` requires a `reason` |
| A shim names a removal issue | `shims.test.ts`, capped at 5 |
| Component states exist | story = browser test + a11y test |
| No `any` | `@typescript-eslint/no-explicit-any: error` |
| All of it | `pnpm verify`, same commands locally and in CI |

### A bug this caught in its own config

ESLint flat config merges by **rule name**. Two config objects that both match a
file and both set `no-restricted-imports` do not combine their patterns — the
later replaces the earlier wholesale, and the first set silently stops being
enforced. The config still loads and lint still passes.

Writing tests that lint a real file at each guarded path caught it. Each layer
now declares one complete entry.

### Provenance

```ts
type Provenance =
  | { source: 'reui';        registry: string[] }
  | { source: 'composition'; composes: string[] }
  | { source: 'custom';      reason: string }   // required, in the type
```

A component cannot be *quietly* custom — TypeScript will not compile it.

---

## 6. The UI foundation

```
Need a component
      ├─ Does ReUI provide it? ────── yes ──> use it        REUI
      ├─ Can it be composed? ──────── yes ──> compose       COMPOSITION
      └─ Neither ───────────────────────────> custom, with a reason
```

**No V2 component introduces another UI foundation.** The stack is fixed:
ReUI → Base UI → Tailwind → Flexprice tokens. V1's Radix components stay
untouched during migration.

**Primitives** (vendored): avatar, button, card, checkbox, dialog,
dropdown-menu, input, label, popover, radio-group, select, separator, skeleton,
spinner, tabs, tooltip — plus ReUI's `badge`, `data-grid`, `stepper`.

**Compositions** — generic, knowing nothing about billing:

| | What it owns |
|---|---|
| `Field` | label/control/hint/error, with `aria-describedby` reaching **both** hint and error |
| `Section` | a region labelled by a real heading |
| `EmptyState` | separates "none yet" from "none matching" |
| `Toolbar` | controlled search + filter landmark |
| `WorkflowStepper` | ReUI's stepper re-addressed by stable id, for URL-safe state |

**Flexprice** — components that speak billing:

| | Why it is not generic |
|---|---|
| `Money` | takes a domain `Money`; cannot be handed a float |
| `Metric` | direction and sentiment are **separate** — up is good for revenue, bad for failed payments |
| `UsageMeter` | models unlimited, over-limit and zero-allowance |
| `InvoiceStatusBadge` | one place mapping statuses to accessible variants |

### Vendored code

ReUI does not ship against this repo's strictness (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`). Hand-patching it would break "an upstream fix stays
a re-install", so a re-runnable script marks vendored files `@ts-nocheck`, and
`pnpm ui:add` does both steps. **Our own components stay fully typechecked.**

---

## 7. Testing

```
domain / mappers    plain functions, no DOM
query               retry policy, key structure, mappers
api                 the real SDK with a stubbed fetcher
eslint-config       lints a real file at each guarded path
ui                  every story, in real Chromium, with a11y as errors
app                 URL codecs, round-trip properties
```

One story file is the workbench, a browser test **and** an accessibility check.
None can drift, because there is only one of them.

```
Foundation/Compositions/*    generic, reusable
Foundation/Flexprice/*       billing vocabulary
Surfaces/*                   real product screens
```

Every story renders from domain fixtures with **no QueryClient, no SDK, no API
mock, no provider and no network**. That property is enforced: adding
`import { useInvoices } from '@fp/query'` to a story file fails lint.

`a11y: { test: 'error' }` makes accessibility a **failure**, not a panel someone
might read.

---

## 8. Agentic-first, concretely

A chat box over a dashboard is not an agentic frontend. V2 means four things:

**1. The repo is legible to agents.** Generated types, enforced boundaries,
`pnpm verify` as one health signal. The measurable lever is that a wrong move is
a lint or type error, not a review comment three days later.

**2. Every capability is declared once.**

```ts
defineAction({
  id: 'subscription.pause',
  title: 'Pause subscription',
  description: 'Stops billing a subscription without cancelling it.',
  input: z.object({ subscriptionId: z.string().min(1) }),
  permissions: ['subscription:write'],
  risk: 'write',
  run: (input, ctx) => …,
})
```

One declaration, four consumers: the UI button, the ⌘K palette, the WebMCP
bridge, and MCP tool descriptors.

**3. An agent is the user, with the user's rights.** There is one `invoke()`,
so there is no agent bypass. Sensitive actions require confirmation of **that**
invocation — approval never carries to the next call.

**4. The app is drivable.** Stable roles and URL-encoded state. Playwright and
browser agents want identical affordances, so the investment is made once.

Kept thin on purpose: no agent runtime, no prompt handling, no planning, no chat
surface, and **nothing in the core UI depends on this package**.

---

## 9. What was proved, and how

Four slices, each applying different pressure. **Zero shims across all four.**

| Slice | Proves |
|---|---|
| **Invoice grid** | SDK → domain → query → page → UI, server-side paging/sorting/filtering |
| **Price override form** | RHF + Zod + domain invariants under complex conditional validation |
| **Workflow composition** | page/URL → stepper → independent steps |
| **Features migration** | that the rules reduce complexity on a real V1 surface |

### Migration 1 — Features

| | V1 | V2 |
|---|---:|---:|
| Source LOC | 2,017 | **983** |
| `useState` | 13 | **0** |
| Largest file | `AddFeature.tsx` **1,106** | `FeatureForm.tsx` **275** |
| Tests / stories | **0** | **60** |
| API classes | 3 | 0 |
| Hand-rolled table | 1 | ReUI `data-grid` |
| Deep-linkable list | no | yes |

LOC reduction is not the goal. **What disappeared** is the point: a bespoke form
hook, four state slices, two validator callbacks, three hand-written API
clients, and a hand-rolled table.

---

## 10. Bugs found on the way

Writing rules down finds bugs. These were found by building, not by auditing.

### Live billing defect — zero multiplier accepted

```ts
if (!meterData.aggregation?.multiplier || meterData.aggregation.multiplier <= 0) { … }
```

`multiplier` is a **string** on the wire. `'0' <= 0` is `false`, and `'0'` is
truthy, so neither branch fires.

```
SUM_WITH_MULTIPLIER, multiplier = "0"  ->  accepted  ->  usage × 0  ->  $0 billed
```

Escalated as its own correctness ticket: V2 fixing its validation does **not**
fix existing V1-created data, nor protect the API, SDKs, MCP server or import
tooling. See `docs/tickets/`.

### Silent revenue bugs in price tiers

- **Overlapping bands** bill the wrong amount. Nothing catches it until an
  invoice is wrong.
- **A closed final band** drops all usage above it — revenue lost silently.

Both are now schema errors, and the unbounded band cannot be removed.

### Rules that could not be checked outside a form

V1 decides whether to require an aggregation `field` or `expression` by reading
a `showCustomExpression` boolean out of component state — so the rule only
exists while the form is mounted.

### State that survives when it should not

V1 keeps meter data in a separate state slice, so switching a metered feature to
Boolean leaves the meter in scope, submittable and invisible. The discriminated
union makes that unrepresentable.

### Three accessibility defects

| | Found by |
|---|---|
| Solid badges at 2.47:1 and 4.4:1 against a 4.5:1 AA threshold | a11y gate |
| `text-success` fails as a foreground (background-tuned green) | a11y gate |
| ReUI's `Stepper` declares `role="tablist"` with no `role="tab"` children | a11y gate |

None were visible by eye. All three would have shipped.

### A malformed schema in the published spec

`types.Duration` is emitted as **both** an object and an enum — the Go constant
`EntitlementGrantMinDuration` leaking onto the type carrying it. Strict OpenAPI
tooling rejects the document outright.

---

## 11. The backend dependency

> **Backend dependency — OpenAPI annotation completeness**
> **Owner:** Backend.
> **Impact:** real data for the subscription workflow and the Customer Portal.
> **UI impact:** none for architectural development; blocks production
> integration of the affected surfaces.

**320 handlers are registered as routes. 211 carry a `@Router` annotation.
~109 (34%) are absent from the OpenAPI document** — and therefore from all four
SDKs and the MCP server — while working fine in production.

### The gap is narrower than it looks

For catalogue and customer surfaces, the missing handler is almost always the
plain `GET` list — and every one of those entities has a **documented
`POST /<entity>/search`** that is strictly more capable:

| File | Documented | Missing |
|---|---|---|
| `payment` | 6/6 | — |
| `customer` | 10/11 | `ListCustomers` |
| `addon`, `coupon` | 8/9 | `ListAddons`, `ListCoupons` |
| `price` | 7/8 | `ListPrices` |
| `entitlement` | 6/7 | `ListEntitlements` |
| `plan` | 9/11 | `ListPlans`, `SyncPlanPricesV2` |
| `feature` | 5/7 | `ListFeatures`, `GetFeature` |

Those surfaces are migratable **today, with no shims**.

### Genuinely blocked

`customer_portal` **0/25** · `webhook` 0/12 · `meter` 0/6 · `connection` 0/6 ·
`environment` 1/5 · `auth` 0/2 · `workflow` 1/5

**Do not add shims because the backend is temporarily incomplete.** Four slices
with zero shims is evidence the generated boundary works. A shim added for
convenience spends that evidence.

---

## 12. Migration strategy

> **New code follows V2. Existing V1 code migrates when touched, or when there
> is a clear product or maintenance benefit.**

```
V1 surface touched
      ↓
Can it be migrated cleanly?
      ↓
Yes  -> migrate using V2
No   -> isolate, and write down why
```

Every migration records a before/after: API classes → SDK calls, DTOs → domain
mapping, `useState` → RHF, modal → page/stepper, component fetching → page +
query, hand-rolled table → ReUI, untested states → story + browser test,
implicit rules → domain tests, special-case adapter code → 0 shims.

```
Features  ->  Review / refine rules  ->  Addons  ->  Compare  ->  Freeze playbook  ->  Scale
```

### Architecture freeze

No new package layers, no new abstraction categories, no second component
taxonomy, no other state-management solution, no speculative agent
infrastructure, and no further proofs for their own sake. **Unless a real
migration exposes a problem, the architecture is good enough.**

---

## 13. Getting started

Requires Node 24+ and pnpm 11+.

```bash
pnpm install

cp apps/console/.env.example apps/console/.env.local
# VITE_FLEXPRICE_API_URL=https://api.cloud.flexprice.io/v1
# Never put a Flexprice API key here — VITE_ variables are served to every visitor.

pnpm dev                              # console on :3000
pnpm --filter @fp/ui storybook        # the UI showcase on :6006
```

| Command | What |
|---|---|
| `pnpm verify` | typecheck + lint + test + build — the definition of healthy |
| `pnpm lint` | ESLint, including the architecture boundaries |
| `pnpm --filter @fp/ui test:stories` | every story in real Chromium, with a11y |
| `pnpm --filter @fp/ui ui:add <item>` | install a ReUI item and re-apply vendor suppression |

### Docs

| Topic | File |
|---|---|
| Layers, decisions, the constraint matrix | [`docs/architecture.md`](docs/architecture.md) |
| The UI foundation and the ReUI rule | [`docs/ui-foundation.md`](docs/ui-foundation.md) |
| The annotation gap and its phasing | [`docs/api-contract-gap.md`](docs/api-contract-gap.md) |
| Migration rules and measurements | [`docs/migration.md`](docs/migration.md) |
| ReUI setup and the licence | [`docs/reui.md`](docs/reui.md) |
| Correctness tickets | [`docs/tickets/`](docs/tickets/) |

---

## 14. Open decisions

### Derived invoice filters

`overdue` is derived and is not an API value. Current behaviour is deliberate:
`deriveInvoiceStatus()` computes it, `isServerFilterable()` states what the
server understands, `toInvoiceFilter()` **drops** it rather than approximating.

**Should derived states become first-class backend filters?**

- **Yes** → the API exposes `OVERDUE` semantics and the frontend deletes a rule.
- **No** → the frontend defines an explicit client-side strategy, with its
  pagination cost understood and written down.

What must **not** happen is the UI quietly translating it to
`invoiceStatus = FINALIZED AND paymentStatus != SUCCEEDED`. That is the UI
inventing business semantics, and it will disagree with the backend eventually.

### Feature type filtering

`FeatureFilter` has no type filter, so it is applied client-side — narrowing
**the current page**, not the whole set. Same class of problem, same treatment:
named, not approximated.

### Features is not yet on the UI foundation

It uses `FeatureGrid` and `FeatureForm`, but not `Toolbar`, `EmptyState` or
`Section` — those did not exist when it was migrated. It currently answers *"did
we move Features to the new architecture?"* but not *"did we migrate Features to
the new Flexprice UI system?"* That is the first task when migrations resume.

### Not yet reviewed

Everything here is self-verified. 310 tests and a green pipeline are evidence,
not review.

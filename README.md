# Flexprice Portal

The **Flexprice Portal** is the web application for managing customers, contracts, invoices, payments, product catalog, developer tools, and platform settings.

It is built with **React + Vite** in a **pnpm + Nx monorepo** and communicates with the Flexprice API through the generated `@flexprice/sdk`.

## Repository Structure

```text
apps/
  console/          Portal application, routes, pages, URL state, E2E and visual tests

packages/
  ui/               Shared UI components, forms, layouts and Storybook
  domain/           Product types, Zod schemas and Money utilities
  query/            API data layer: SDK calls, mappers and React Query hooks
  api/              SDK client, authentication and API error handling
  actions/          Shared actions used by buttons, ⌘K and agents
  sdk-adapter/      Small shims for SDK gaps
  eslint-config/    Architecture and dependency rules

scripts/             Repository checks and UI documentation tools
docs/                Architecture, forms, guardrails and development guides
```

## Architecture

The Portal follows a simple layered architecture:

```text
Pages
  ↓
UI / Query / Actions
  ↓
Domain
  ↓
SDK
```

### Responsibilities

* **Pages** — Connect application data with UI components.
* **UI** — Presentational components. No API calls or SDK imports.
* **Query** — The only data-access layer. Handles SDK calls, mapping and React Query.
* **Actions** — Defines capabilities that can be triggered from the UI, ⌘K or agents.
* **Domain** — Framework-independent business types, schemas and utilities.
* **SDK** — Generated client for the Flexprice API.

Architecture boundaries are enforced through **ESLint**, so invalid dependencies fail the build.

## Getting Started

### Requirements

* Node.js 24+
* pnpm 11+

### Install

```bash
pnpm install
```

Create your local environment:

```bash
cp apps/console/.env.example apps/console/.env.local
```

Start the Portal:

```bash
pnpm dev
```

The Portal runs at:

```text
http://localhost:3000
```

Start Storybook:

```bash
pnpm --filter @fp/ui storybook
```

Storybook runs at:

```text
http://localhost:6006
```

The sidebar mirrors the console: **Start here**, **Design system**, **Building
blocks** (generic parts) and **App** (one folder per nav area, each opening with
the whole page in the console shell, then its parts). `packages/ui/src/README.md`
maps each folder to its section. There is also a **Design system → Page map**
listing which kit components each page uses, and an **Anatomy** panel on every
story. The panel reads
`packages/ui/src/design-system/anatomy.generated.json`; `storybook` and
`build-storybook` regenerate it, or run `pnpm ui:anatomy` yourself and commit the
result. The workbench is published by `.github/workflows/storybook-deploy.yml`
(setup in `.github/workflows/README.md`).

### Running without an account

For local development, you can use the bundled mock data:

```env
VITE_USE_MOCKS=true
```

Otherwise, configure the Flexprice API:

```env
VITE_FLEXPRICE_API_URL=...
```

Then sign in through `/sign-in`.

> **Security:** Never put API keys in `VITE_` environment variables outside `.env.local`. Vite exposes `VITE_` variables to the browser.

## Adding a New Screen

The standard flow is:

```text
Domain type/schema
      ↓
Query hook
      ↓
UI component + Story
      ↓
Portal page
```

For a complete example, follow:

[`docs/adding-a-surface.md`](docs/adding-a-surface.md)

For forms and create/edit flows, follow:

[`docs/forms-and-editing.md`](docs/forms-and-editing.md)

Forms use:

* `react-hook-form`
* Domain Zod schemas
* The same form for create and edit
* A shared preview where applicable

## UI Rules

The shared UI package is partially vendored from ReUI and is protected by hash checks.

### Do not manually edit

```text
packages/ui/src/components/
  primitives/
  reui/
  blocks/
  examples/
  ui/
```

To add or update a vendored component, use:

```bash
pnpm --filter @fp/ui ui:add <item>
```

### Component requirements

Every shared component must:

* Declare its `provenance(...)`
* Import every component referenced by `composes`
* Include a Storybook story
* Include an entry in `packages/ui/CHANGELOG.md`

### Design rules

* Use semantic design tokens instead of raw colors.
* Do not use `font-semibold` or `font-bold`.
* Do not use floating-point numbers for money.
* Use `Money` to preserve the exact decimal value returned by the API.

## Before You Push

Run the relevant checks locally:

```bash
# UI
cd packages/ui
npx tsc --noEmit
npx eslint src --max-warnings 0

# Portal
cd apps/console
npx tsc -b
npx eslint src e2e --max-warnings 0
```

Repository-wide checks:

```bash
pnpm test
node scripts/check-vendor.mjs
pnpm ui:matrix
pnpm verify
```

`pnpm verify` runs the complete validation pipeline including typecheck, lint, tests and build.

## Testing

| Test             | Command                             |
| ---------------- | ----------------------------------- |
| Unit             | `pnpm test`                         |
| Storybook + a11y | `pnpm --filter @fp/ui test:stories` |
| E2E              | `cd apps/console && pnpm test:e2e`  |
| Visual           | `pnpm test:visual`                  |

### Visual Tests

Visual tests run at **1440×900**.

Visual baselines are generated in Linux CI. If a visual change is intentional:

1. Download the `visual-<runId>` artifact from the failed CI run.
2. Review the screenshots.
3. Replace the expected PNGs in:
   `apps/console/e2e/visual/__screenshots__/`
4. Commit the updated baselines.

Do not generate visual baselines locally on macOS or Windows.

## Commit and Pull Request

Use Conventional Commits:

```text
feat:
fix:
chore:
```

Commitlint runs automatically through the repository hooks.

Open pull requests against `main`.

CI validates:

* Build
* Typecheck
* Lint
* Unit tests
* SAST
* Storybook
* E2E
* Visual tests
* Deployment

All required checks must pass before merging.

## Documentation

For deeper details, see:

* [`docs/architecture.md`](docs/architecture.md) — Application architecture
* [`docs/component-guardrails.md`](docs/component-guardrails.md) — UI and component rules
* [`docs/ui-foundation.md`](docs/ui-foundation.md) — UI foundation
* [`docs/migration.md`](docs/migration.md) — Migration notes
* [`docs/ui-page-matrix.md`](docs/ui-page-matrix.md) — Page/component inventory
* [`UI_SOURCE_OF_TRUTH.md`](UI_SOURCE_OF_TRUTH.md) — UI source of truth

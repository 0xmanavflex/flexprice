# Flexprice Console

The Flexprice dashboard (V2): customers, contracts, invoices, payments, product catalog, developer tools and settings. React + Vite, pnpm + Nx monorepo, talks to the Flexprice API through the generated `@flexprice/sdk`.

## What is in the repo

```
apps/console/        the dashboard: routes, pages, URL state, e2e + visual tests
packages/
  ui/       @fp/ui        components, forms, page layouts, Storybook
  domain/   @fp/domain    product types, zod schemas, Money (pure, no React)
  query/    @fp/query     the only data door: SDK calls, mappers, React Query hooks
  api/      @fp/api       SDK client, auth headers, one error shape
  actions/  @fp/actions   capabilities declared once (buttons, ⌘K, agents)
  sdk-adapter/            shims for SDK gaps (keep empty)
  eslint-config/          the layer rules, as lint errors
scripts/             vendor-hash check, UI page matrix
docs/                architecture, adding a surface, forms, guardrails
```

Layers only point down: **pages → ui / query / actions → domain → SDK**. `@fp/ui` never fetches and never imports the SDK; pages are where data meets components. ESLint enforces it.

## Install

Needs Node 24+ and pnpm 11+.

```bash
pnpm install
cp apps/console/.env.example apps/console/.env.local
pnpm dev                          # console on http://localhost:3000
pnpm --filter @fp/ui storybook    # components on http://localhost:6006
```

No account? Set `VITE_USE_MOCKS=true` in `.env.local` to run on bundled fixtures. Otherwise set `VITE_FLEXPRICE_API_URL` and sign in at `/sign-in`. Never put an API key in a `VITE_` variable outside `.env.local`: those are served to every visitor.

## How we work

**Build a screen.** Domain type/schema → query hook → UI component + story → page in `apps/console`. Copy the Coupons slice; the steps are in [`docs/adding-a-surface.md`](docs/adding-a-surface.md). Forms follow [`docs/forms-and-editing.md`](docs/forms-and-editing.md): react-hook-form + the domain zod schema, and the same form (with its preview) for create and edit.

**Rules that fail the build**

- Don't hand-edit `packages/ui/src/components/{primitives,reui,blocks,examples,ui}/**`. It is vendored and hash-checked; to update, re-install from ReUI (`pnpm --filter @fp/ui ui:add <item>`).
- Every shared component declares `provenance({...})` and every `composes` entry must be imported. Add a story and a line in `packages/ui/CHANGELOG.md`.
- No `font-semibold` / `font-bold`, no raw palette colours: semantic tokens only.
- No floats for money. `Money` holds the exact decimal string the API sent.

**Check before you push**

```bash
cd packages/ui && npx tsc --noEmit && npx eslint src --max-warnings 0
cd apps/console && npx tsc -b && npx eslint src e2e --max-warnings 0
pnpm test                      # unit tests, all packages
node scripts/check-vendor.mjs  # vendored files untouched
pnpm ui:matrix                 # regenerates docs/ui-page-matrix.md; commit it
pnpm verify                    # everything: typecheck + lint + test + build
```

**Test**

| What                           | Command                             |
| ------------------------------ | ----------------------------------- |
| Unit                           | `pnpm test`                         |
| Stories (real Chromium + a11y) | `pnpm --filter @fp/ui test:stories` |
| E2E (mocked API)               | `cd apps/console && pnpm test:e2e`  |
| Visual (1440×900 screenshots)  | `pnpm test:visual`                  |

Visual baselines are generated on Linux in CI. If a screenshot change is intended, download the `visual-<runId>` artifact from the failed run and commit the new PNGs into `apps/console/e2e/visual/__screenshots__/`. Don't update them from macOS/Windows.

**Commit and ship.** Conventional commits (`feat:`, `fix:`, `chore:`; commitlint runs in the hook). Open a PR to `main`. CI runs Build, Lint, Unit, SAST, Storybook, E2E, Visual and Deploy (Vercel; skips until its secrets are set). All must be green.

## More docs

[`architecture.md`](docs/architecture.md) · [`component-guardrails.md`](docs/component-guardrails.md) · [`ui-foundation.md`](docs/ui-foundation.md) · [`migration.md`](docs/migration.md) · [`ui-page-matrix.md`](docs/ui-page-matrix.md) · [`UI_SOURCE_OF_TRUTH.md`](UI_SOURCE_OF_TRUTH.md)

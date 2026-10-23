# Agent instructions

Flexprice Console V2: a pnpm + Nx monorepo. `apps/console` is the app; `packages/ui` holds every visual part
(kit + pages), `packages/query` the data layer, `packages/domain` the types. Read `README.md` for setup.

## Building UI: read this first

**Before writing or changing any UI, read [`docs/design-rules.md`](docs/design-rules.md) and follow it.** It is
short. The rules that matter most:

1. **Compose kit components; never hand-build markup.** `PageHeader`, `Section`, `EntityList` + `cells`,
   `SimpleTable`, `Properties`, `FormDialog` + `Field`, `SectionEmpty`, `ConfirmDialog`, `Button`. Copy the closest
   existing screen (the table at the top of `docs/design-rules.md`) instead of designing a new one.
2. **Filled `Button` only for the page's one main create action** (`PageHeader` `action`, or `EntityList`
   `primaryAction`). Everything else is `variant="outline"`.
3. **A section's CTA lives only in its `Section` header, top right**, in every state. Empty states never repeat
   the create button.
4. **Every row-menu and header-menu item has an `icon`** from `@ui/icons`.
5. **No CSS files, no hex/rgb/oklch or arbitrary colour classes, no new themes, no `font-semibold`/`font-bold`.**
   Tokens only.
6. **A design zip, Figma frame or screenshot is a reference, not code to copy.** Map it onto kit parts.
7. If no kit part fits, stop and ask; do not invent one in a page.

`pnpm lint` enforces most of this (`packages/eslint-config/src/design.js`, `architecture.js`); a lint error's
message says what to use instead. Do not silence it.

## Where code goes

- UI never fetches: pages in `packages/ui` take data and callbacks as props; `apps/console` wires `@fp/query`
  hooks to them. Details: `docs/adding-a-surface.md`.
- Do not hand-edit vendored code under `packages/ui/src/components/**` (`scripts/check-vendor.mjs`).
- A new page or shared part ships with a story in its folder; see `packages/ui/src/README.md` for the map.
- Visual source of truth and its reasons: `UI_SOURCE_OF_TRUTH.md`.

## Checks

```bash
pnpm typecheck
pnpm lint            # --max-warnings 0
pnpm test
```

The pre-push hook (`.husky/pre-push`) runs typecheck, lint, the repo checks and the build.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

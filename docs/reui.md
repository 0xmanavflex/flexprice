# ReUI setup

ReUI is the component registry for V2. The rule it exists to serve: **reuse
before you build.** Search order for any UI need is

> ReUI component → ReUI example → ReUI block → a composition over ReUI parts → custom

and a custom component needs a stated reason. Never fork a ReUI component to
change it; compose around it.

## What is installed

| | |
|---|---|
| Agent skill | `0fa9ecfa6e` (current as of install) |
| MCP server | `https://mcp.reui.io/api/mcp`, wired in `.mcp.json` |
| Plan | Licence reports **Ultimate**: premium blocks and Motion Icons unlocked. Ultimate is a per-seat tier; the unlimited-seat tier is Enterprise |

The skill is vendored for four agents: `.claude/`, `.agents/`, `.cursor/`,
`.opencode/`: so a teammate on Cursor or OpenCode gets the same workflow rules
as one on Claude Code. Four identical copies, ~460 KB total. Collapse to
`.claude/` alone if the team standardises on one agent.

**Keeping it current:** the skill is a vendored snapshot and goes stale.
Watchtower's copy is on `d9f4a302f4` while `0fa9ecfa6e` is current: which is
the failure mode to avoid. `get_agent_skill` reports the latest version; re-run
`curl -fsSL https://mcp.reui.io/install | node -` from the repo root to update.

## The licence

Never committed. It lives in two git-ignored files:

| File | Read by | Ignored via |
|---|---|---|
| `.env.local` | the shadcn CLI, at install time | `.env.*` |
| `.claude/settings.local.json` | Claude Code, for the MCP | explicit line |

`.mcp.json` references it as `${REUI_LICENSE_KEY}` and is safe to commit.
`.env.example` documents the variable with no value.

For Codex / Cursor / OpenCode, export it from your shell profile:
`export REUI_LICENSE_KEY=<key>`.

A licence is needed only to **install** premium blocks. The 22 components and
every `c-*` example are free.

## Icons

Every icon in the app is a ReUI **Motion Icon** in the **outline** style. There
is no other icon library; `lucide-react` is not a dependency.

**One file decides which icon is used:** `packages/ui/src/icons/icon-map.json`.

```json
"Zap":   { "reui": "bolt", "animated": true },
"Plus":  { "reui": "plus" },
"ChevronDown": { "reui": "chevron-right-outline", "rotate": 90 }
```

The key is the name code imports (`ZapIcon` or `Zap`), `reui` is the registry
item, `animated` picks the animated variant (it animates on hover; only about a
tenth of the set has one, so it is used where the metaphor fits), and `rotate`
turns a glyph, which is how one chevron serves all four directions.

To add or swap an icon, edit the map and run:

```bash
pnpm --filter @fp/ui icons:sync
```

That installs what is missing (needs the licence, see above), prunes what is
unused, and regenerates `packages/ui/src/icons/index.ts`: the barrel, which
you do not edit. Installed icons live in `packages/ui/src/reui/icons/` and are
committed, so CI and teammates never need the key. They are vendored like the
other ReUI code: hash-locked in `vendor.lock.json`, never hand-edited.

**Importing.** First-party code uses `@fp/ui/icons` (inside `packages/ui`:
`@ui/icons`). ESLint rejects `lucide-react` there.

**Vendored registry code** (primitives, blocks, examples) still says
`import { X } from 'lucide-react'`. We do not edit it, so the build aliases
`lucide-react` to the same barrel in Vite, Vitest, Storybook and both
tsconfigs. Vendored files therefore render ReUI icons too, and a block updated
from the registry keeps working. If a registry update imports a lucide name
that is not in the map, `pnpm icons:sync` is the fix: add the entry.

**Licence terms that matter here:** the repository must stay private, the icon
source must not be redistributed, and a shipped build must not let users
extract the original source. The console build emits no sourcemaps; check that
before enabling them or publishing Storybook publicly.

## Two decisions still open

`components.json` cannot be written until both are made: and without it
`shadcn add @reui/...` will not resolve. Neither should be decided by whoever
installs the first component.

**1. Base UI or Radix**: `style: "base-nova"` vs `"radix-nova"`.

Watchtower chose `base-nova`, so Radix leaves the bundle with the shadcn layer.
The dashboard that actually has to migrate is Radix + Tailwind v3, and ~34
shadcn primitives sit on it. This is the "evaluate the implementation separately
from the principle" call: matching Watchtower buys one platform, matching the
existing app buys a cheaper migration. It also decides which docs and preview
URLs the MCP returns (`X-Reui-Style` header).

**2. Frame or Card surface**: pass `surface` on every `search` and
`compose_page`.

Blocks render on one of two surfaces and **mixing them looks inconsistent**.
Pick one for the whole product. Surface-neutral blocks (heroes, app shells,
auth) fit either.

## What ReUI replaces

The V1 dashboard hand-rolled **55 `*Table*.tsx` components** and has **zero**
`react-hook-form` usage against **1,036 `useState`s**. ReUI's `data-grid` is a
TanStack Table v9 contract: *"no `data`/`columns` props and never a hand-rolled
`<table>`"*: and it is the single largest reuse win available. Blocks like
`solution-billing-1` (invoice ledger with past-due recovery) and
`data-grid-filtering-1` (billing transactions grid with a multi-field filter
bar) map directly onto surfaces V2 has to build.

## Working with it

Golden path, per the skill: `search` → `get_component` to read the **real** API
before writing props → `get_install_command` → install → adapt by wiring real
data → `validate_usage` and `get_audit_checklist` before finishing.

Always share an item's `previewUrl` when recommending it, so the choice is made
by eye rather than from a description.

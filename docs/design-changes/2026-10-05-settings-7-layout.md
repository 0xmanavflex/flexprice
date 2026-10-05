Title: Settings uses the ReUI `settings-7` layout

Old reference: the reference app's settings page (`settings.tsx`): a line-tab strip of sections across the top,
a pill row of tabs beneath it, panels in a `max-w-4xl` column.
New reference: ReUI `settings-7` (`pnpm dlx shadcn@latest add @reui/settings-7`, already vendored under
`packages/ui/src/components/blocks/settings-7`): a "Settings" heading, a vertical rail of sections on the left,
the active section's content in a column on the right.

Why: requested by the product owner on 2026-10-05, after the reference-matching pass. The panels were already
drawn with `settings-7`'s cards and rows (`compositions/settingsSurface.ts`); this makes the shell match them.

Affected:
[x] a shared composition: `SettingsShell` (`packages/ui/src/pages/settings/SettingsShell.tsx`)
[x] pages: every settings tab (one shell)
[x] visual baselines: `settings-organization`, `settings-team`, `settings-developers`
[ ] tokens, typography, shell/sidebar: unchanged

Retired: the line-tab section strip and the `max-w-4xl` single-column layout of `SettingsShell`.

Decision: product owner, 2026-10-05.

Notes on the adaptation:

- The block hard-codes its tabs and keeps its own state, so it cannot take Flexprice's sections. The block is
  left untouched; `SettingsShell` reproduces its layout over the same `Tabs` primitive and stays fully controlled
  (URL-backed section and tab).
- Differences from the block: `font-medium` for the heading (no semibold in this system), `max-w-5xl` instead of
  `max-w-4xl` so table panels keep their width beside the rail, and a second pill row for a section's own tabs.
- Accessible names (`Settings`, `<Section> tabs`) are unchanged, so the stories and journeys still address it.

Migration: none. One composition, no page changes.

Title: A strip under the shell header to switch between the old and new console

Old reference: no strip. The only way back to V1 was the migration placeholder's "Open in the current dashboard"
button, on pages V2 does not have yet.
New reference: a one-line strip under the shell header on every page, full width, `bg-muted/60` with a bottom
rule: "You are on the new Flexprice console. Go back to old UI ↗". The link opens V1 (`VITE_LEGACY_CONSOLE_URL`)
in a new tab, so an unfinished form is not discarded. V1 (flexprice-front#1520) carries the mirror, "Take me to the
new UI", in the slot of its existing restricted-environment banner.

Why: product review on 2026-11-03. While both consoles run, people moving to V2 need a constant, obvious way back,
and V1 users need one way in.

Affected:
[x] shell: `AppShell` gains a `strip` slot under the header.
[x] shared composition: `ShellStrip` (new), with a story.
[x] pages: `ConsoleShell` passes the strip only when `VITE_LEGACY_CONSOLE_URL` is set.
[ ] visual baselines: route baselines run without `VITE_LEGACY_CONSOLE_URL`, so they do not change.
[ ] tokens, typography: unchanged

Retired: nothing permanent. The strip is migration scaffolding: delete `ShellStrip`, the `strip` slot and the
`ConsoleShell` wiring when V1 is switched off.

Decision: product owner, 2026-11-03 (requested in the review feedback). Design-system review on PR #284.

Migration: none.

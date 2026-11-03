Title: A "What's new" changelog stack at the foot of the sidebar

Old reference: nothing in the sidebar between the navigation and the account menu. What changed from V1 lived only
in release notes outside the console.
New reference: ReUI `app-shell-7`'s sidebar news stack (vendored at
`packages/ui/src/components/blocks/app-shell-7`), rebuilt as `ShellChangelog`. The newest card sits on top with two
peeking behind; swipe or Dismiss takes it off, a tap or "Read more" opens its docs.flexprice.io page in a new tab,
and "You're all caught up" shows briefly once the stack is cleared. Hidden when the sidebar is collapsed. The block's
photograph is replaced by the product's own line figure (`SceneIllustration`) for the area the change touches.

Why: product review on 2026-11-03. People moving from V1 need to see what changed and where to read about it,
without a release-notes page to go looking for.

Content plan (`apps/console/src/app/shell/changelog.ts`):

- Six entries at most, newest first; the stack shows three. A new release adds an entry at the top with a new id and
  drops the oldest.
- Each entry: a title under five words, one summary sentence, a docs.flexprice.io page that exists today, and a
  scene for its area.
- Dismissals are remembered per entry id in `localStorage` (`fp.changelog.dismissed`), so a reload does not bring a
  card back and a new entry still shows to someone who cleared the old ones.
- The first set is V1 → V2: the new console (search, environments), contracts, add-ons like plans, wallet bonus
  credits and the ledger, the customer page, and the events debugger.

Affected:
[x] shell: `AppShell`'s existing `pinned` slot carries it; no slot added.
[x] shared composition: `ShellChangelog` (new), with stories; `AppShell` `WithChangelog` story.
[x] vendor: `@reui/app-shell-7` added as the reference (`vendor.lock.json`).
[ ] visual baselines: every route shows the stack in the sidebar, so the route baselines need a refresh.
[ ] tokens, typography: unchanged

Retired: nothing; the `pinned` slot had no content in the console.

Decision: product owner, 2026-11-03 (requested in the review). Design-system review on the PR.

Migration: none.

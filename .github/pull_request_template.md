## Summary

<!-- What changed and why. -->

## UI changes

<!-- Delete this section if the PR changes no rendered UI. -->

- Page or component affected:
- Reference (file in the reference app, or screenshot):
- Pattern: list / detail / form / settings / dashboard
- Shared parts used (from `UI_SOURCE_OF_TRUTH.md`):
- Deviations from the reference, each with a reason (or "none"):
- Visual: before, after, and the diff from `pnpm test:visual` (attach or link):
- Baselines updated: yes / no. If yes, why:

## Checks

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`
- [ ] `pnpm test:visual` passes, or every diff is intended and explained above
- [ ] `node scripts/check-vendor.mjs` passes (no hand edits to vendored UI)
- [ ] `node scripts/ui-page-matrix.mjs --check` passes
- [ ] No new bespoke component where a shared one exists
- [ ] Behaviour covered: validation, submit, error and empty states

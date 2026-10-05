# Visual regression

One viewport screenshot per route, compared against a committed baseline. A
change to a shared composition or `styles.css` that moves pixels fails here and
shows which pages moved.

It exists because typecheck, lint, Storybook a11y and the journeys were all
green while the UI drifted from the reference design: nothing compared what was
rendered. Same system under test as the journeys — the mocked build
(`VITE_USE_MOCKS=true`, MSW serving the fixture corpus).

- `routes.ts` — the contracts: route, reference page, pattern, what must be
  visible before capture.
- `visual.spec.ts` — one test per contract, plus the shell's open surfaces
  (menus, filter popover, a dialog).
- `__screenshots__/` — the baselines, one `<name>.png` per test, no platform
  suffix.
- `../../playwright.visual.config.ts` — pins viewport (1440x900), scale, locale,
  timezone, light scheme, reduced motion. The clock is frozen in the spec.

## Run

```sh
pnpm test:visual                        # from the repo root; starts the app itself
E2E_BASE_URL=http://localhost:3200 pnpm test:visual   # against a server you started
pnpm --filter console exec playwright test -c playwright.visual.config.ts plans   # a subset
```

A failure writes `actual`, `expected` and `diff` images under
`apps/console/test-results/` and an HTML report to `apps/console/playwright-report/`.
CI uploads both.

## Update baselines

```sh
pnpm test:visual:update
```

**Baselines may only be updated in a PR that says why and shows the diff.** A
changed `.png` is a changed screen: the PR description names the pages that
moved and the reason (attach before/after, or link the report), and a reviewer
looks at the images, not just the file list. "Update snapshots" to make CI green
is how the drift this layer exists to catch gets approved.

Baselines are generated on **Linux chromium**, the same as CI. Fonts and
anti-aliasing differ on macOS and Windows, so baselines made there fail in CI.
On another OS, generate them in a Linux container or let a Linux machine do it.

## Adding a route

Add a row to `routes.ts` with a real fixture id, run `pnpm test:visual:update`,
and commit the new `.png`. If a page is not deterministic, do not add it with a
looser threshold: fix the determinism (freeze, wait) or leave it out with a
comment in `routes.ts` saying why.

## Next step: compare against the reference app

Each contract carries `reference`, the reference app's page file that defines it.
The follow-up is to capture those pages from the reference app at the same
viewport and diff them against these baselines, so the check becomes "does this
match the design" and not only "did this change". That needs a mapping from
contract to reference route and a tolerance that accepts data differences (the
reference app has its own sample data); it is not part of this suite yet.

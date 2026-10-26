# AGENTS.md — end-to-end tests

Rules for the console's Playwright tests.

> `pnpm --filter console test:e2e` runs this suite. Playwright starts the app
> locally with `VITE_USE_MOCKS=true`, so MSW serves the captured fixture corpus
> and no request reaches a backend. Every surface is built and renders fixtures,
> so the journeys assert what is already a promise — that each surface is
> reachable and addressable, that the shell holds around it, and that the query
> lives in the URL. What the records are will change when the data layer lands;
> that they are addressable will not.

Strategy: [`docs/testing-strategy.md`](../docs/testing-strategy.md).

## What this layer is for

Storybook stories run as browser + a11y tests answer "is the component right?".
These answer **"does the assembled application hold together?"** — the shell
wrapping every route, the router resolving real paths, the URL carrying the
query. That is a different question, and a green component suite is not evidence
for it.

Today the app under test is the locally-served, mocked build, because there is
no deployment. When one exists, set `E2E_BASE_URL` and the same suite runs
against it — the journeys are written against promises a real deployment keeps
too, so they carry over unchanged.

## Test journeys, not widgets

A test asserts that a user can complete something the product promises:

1. Move across the sidebar's surfaces; each keeps its own URL and the shell
   survives the navigation.
2. Open a surface directly by its URL — the case a click-through cannot catch.
3. A group heading routes to its first child rather than a dead end.
4. Filter a list and see the query in the URL; reload and see it survive.
5. Open a record and land on **its own address**, not a modal a link cannot
   reach.
6. Reach a detail surface's real promise — a coupon's "Where used".

"The search box exists" is not a test — it restates the DOM. "Typing a filter
puts it in the URL, and a reload rebuilds it from there" is.

The URL as the source of truth for the query is **the** V2 promise, so it is a
test: the query string is asserted and asserted to survive a reload, not
assumed.

## Writing them

- **Select by role and accessible name**, not by CSS class or test-id. A test
  that breaks when a class is renamed is testing the wrong thing; one that
  breaks when the accessible name disappears has found a real regression. Where
  a surface has no landmark to scope by — the ReUI sidebar renders a labelled
  `<div>`, not a `<nav>` — scope by the accessible label it does expose, in the
  page object, so the compromise lives in one place.
- **Page objects for shared surfaces** — the shell, a catalogue list, a detail
  page — so a UI change updates one file rather than every spec.
- **No fixed waits.** Wait for the state you expect, not for a duration. `fill`
  then assert the URL; do not `waitForTimeout`.
- **Do not pin fixture specifics.** Open "the first row", not a named record;
  assert `/plans/<id>` addresses a plan, not that the id is a particular one.
  The corpus will grow, and a test that counts it breaks on every addition.
- **Independent tests.** Each navigates from a known URL and asserts its own
  state; no ordering assumptions between tests.
- **erasableSyntaxOnly.** Page objects assign their locators in the constructor
  body — no parameter properties, no enums; `import type` for types.
- **`test` and `expect` come from `./fixtures`**, not `@playwright/test`. It
  adds the browser-console and failed-request logs a failing journey's report
  needs (`e2e/reporters/journey-reporter.ts`, `docs/e2e-testing.md`). Types
  still come from `@playwright/test`.
- **Credentials only from the environment** — `E2E_USER` / `E2E_PASSWORD` for
  the dedicated E2E account, never a person's, never in a file.

## What belongs here vs the component layer

- A single component's states — loading, empty, error, a filter changing what is
  shown — belong in its **Storybook story**, run as a browser + a11y test
  (`pnpm --filter @fp/ui test`). That is faster, isolated, and does not need the
  router or MSW.
- The **assembly** — routing between real paths, the shell surviving, the URL
  reflecting the query end to end — belongs here. If a test would pass with the
  shell and router stubbed out, it is a component test wearing a browser.

## Failures must be diagnosable from CI

Trace, video and screenshot on every failure, always on — not a flag someone
remembers to add. A failing run should be diagnosable from its artifacts without
reproducing it by hand.

A flaky test is a broken test. `retries: 0` is deliberate: a suite people have
learned to re-run is a suite that no longer gates anything. Fix it or delete it.

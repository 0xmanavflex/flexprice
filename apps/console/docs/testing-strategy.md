# Testing strategy

Two layers, answering different questions. Neither substitutes for the other.

| Layer         | Question                        | Runs                             |
| ------------- | ------------------------------- | -------------------------------- |
| Component     | Is each component right?        | `pnpm --filter @fp/ui test`      |
| Journey (e2e) | Does the assembled app hold up? | `pnpm --filter console test:e2e` |

**The rule is not "one test file per source file."** That buys a coverage number
and loses signal, and it pushes tests toward implementation details that break
on every refactor. Test where a failure would actually cost something.

## Layer one — the component layer

The design system's components are documented as **Storybook stories**, and those
same stories run as browser + accessibility tests through Vitest
(`@storybook/addon-vitest`). A story is not just a picture in a catalogue: it is
the test. Each renders in a real browser and is checked for a11y violations, so a
component that looks right but announces nothing is a failure, not a footnote.

What this layer is for:

- Each declared state — loading, empty, error — rendered and asserted.
- Interactions that change what is shown: applying a filter, switching a view,
  opening a drawer.
- Formatting and derivation, where getting it wrong makes a screen lie.

It is fast, isolated, and needs neither the router nor the network. It cannot,
by construction, tell you whether the routes resolve or the shell holds — that is
the next layer's job.

## Layer two — the journey layer

Playwright, against the app served locally with `VITE_USE_MOCKS=true`: MSW serves
the captured fixture corpus and no request reaches a backend. Business journeys,
not individual controls.

The journeys that matter for the console:

1. Move across the sidebar's surfaces; each keeps its own URL and the shell
   survives.
2. Open a surface directly by its URL — the SPA-fallback case a click-through
   cannot catch.
3. A group heading routes to its first child, not a dead end.
4. Filter a list; the query appears in the URL and survives a reload.
5. Open a record; land on its own address, not a modal a link cannot reach.
6. Reach a detail surface's real promise — a coupon's "Where used".

Test the flow, not the button. "The search box exists" tells you nothing; "a
filter goes into the URL and a reload rebuilds it from there" tells you the V2
promise holds.

### Why locally-served and mocked, not deployed

Watchtower runs its e2e suite against a **deployed** URL, because there the
question is "does what users receive work?" — a real deployment, session and API.
The console has no deployment yet, so that question has no target. What it can
answer is "is every surface reachable and addressable, and does the shell hold?"
— and it answers that against itself, built with mocks, which is why
`playwright.config.ts` starts a local `webServer`.

This is deferral, not a different philosophy. Set `E2E_BASE_URL` and the suite
points at that URL and starts no server of its own — the deployed-URL model,
ready the day the console ships. The journeys are written against promises a
real deployment keeps too, so they carry over unchanged.

## The flaky = broken rule

`retries: 0`, on purpose. A flaky test is a broken test: fix it or delete it. A
suite people have learned to re-run is a suite that no longer gates anything.
Trace, video and screenshot are captured on every failure so a break is
diagnosed from CI artifacts rather than reproduced by hand.

## Coverage

Judged by behaviour, not by percentage. The question at review is "is there a
test that would fail if this broke?" — not "what is the coverage number?" A
feature with 90% coverage and no test for its error state is less well tested
than one with 40% and a test for every state it declares.

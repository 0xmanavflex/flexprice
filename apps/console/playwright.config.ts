import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests, run against a locally-served, fully-mocked build.
 *
 * Watchtower's e2e suite runs against a *deployed* URL with no `webServer`,
 * because there the promise under test is "does the application users actually
 * receive work?" — a real deployment, a real session, the real API.
 *
 * The console cannot answer that question yet: there is no deployment. What it
 * *can* answer is "does the shell hold together, and is every surface reachable
 * and addressable?" — and it answers that against itself, built with
 * `VITE_USE_MOCKS=true`, where MSW serves the captured fixture corpus and no
 * request escapes to a backend. So the system under test is the app running
 * locally, and this config starts it: the `webServer` below is the deliberate
 * divergence from Watchtower, not an oversight.
 *
 * The deployed-URL model is not abandoned, only deferred. Set `E2E_BASE_URL`
 * and the suite points at that URL instead and starts no server of its own —
 * which is exactly the shape Watchtower runs in, and the shape this file
 * returns to the day the console is deployed.
 *
 * Strategy: `docs/testing-strategy.md`. Rules: `e2e/AGENTS.md`.
 */
// `E2E_PORT` moves the local server off :3000 when something else holds it —
// locally an existing server is reused, so the wrong app would be tested.
const port = process.env.E2E_PORT ?? '3000'
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

/**
 * The per-journey reports (`e2e/reporters/journey-reporter.ts`): always in CI,
 * and locally with `E2E_REPORT=1` (`pnpm test:e2e:report`). Writes
 * `e2e-results/`; never sends anything anywhere — Slack is a separate step
 * that only the release workflow runs.
 */
const journeyReports = !!process.env.CI || process.env.E2E_REPORT === '1'
const journeyReporter = [
  './e2e/reporters/journey-reporter.ts',
  { outputDir: 'e2e-results' },
] as const

/**
 * Live journeys share one test account and one dedicated environment, so they
 * run one at a time (`E2E_LIVE=1`).
 */
const live = process.env.E2E_LIVE === '1'

export default defineConfig({
  testDir: './e2e',
  // Screenshot regression has its own config and its own CI job
  // (`playwright.visual.config.ts`, `e2e/visual/README.md`): it needs a pinned
  // viewport, a frozen clock and committed baselines, none of which the journeys
  // want. Kept out of this run so the journeys are unchanged.
  testIgnore: ['**/visual/**'],

  // A flaky test is a broken test (`e2e/AGENTS.md`), so a retry is not allowed
  // to turn one green. If a test needs a retry to pass, that is the finding.
  // `E2E_RETRIES` exists for the release run against a real network; even
  // there the journey report records every earlier failed attempt, and only
  // the final attempt decides PASS or FAIL.
  retries: Number(process.env.E2E_RETRIES ?? 0),
  // CI serves a prebuilt bundle (see `webServer` below), so nothing compiles
  // while a test waits and the default test timeout is enough there too.
  timeout: 30_000,
  // Locally the suite runs against the Vite dev server, which compiles each
  // route the first time it is asked for; that cold first load can take
  // 10-15s, so Playwright's 5s default would fail a healthy journey. It buys
  // nothing in CI, where routes are already built, but costs nothing either:
  // a genuinely missing element still fails within 15s.
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  workers: live ? 1 : process.env.CI ? 2 : undefined,

  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        // Read by the CI step that names the failing journeys, rather than
        // reporting "the suite failed" and making someone open the run to
        // learn which surface broke.
        ['json', { outputFile: 'playwright-results.json' }],
        journeyReporter,
      ]
    : journeyReports
      ? [['list'], journeyReporter]
      : [['list']],

  use: {
    baseURL,
    // Always on, never a flag someone remembers to add: a failure has to be
    // diagnosable from CI artifacts without reproducing it by hand.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /**
   * The mocked app, served locally, is the system under test.
   *
   * Omitted entirely when `E2E_BASE_URL` is set — then the target is a real URL
   * the runner must not shadow with a server of its own.
   *
   * In CI the mocked app is built once and served with `vite preview`. The dev
   * server compiles each route on its first request, and on a two-worker
   * runner that cold compile regularly outlasted the 15s `expect` timeout, so
   * a different healthy journey failed each run with "element(s) not found".
   * Building first moves all of that compile into one ~5s step before any test
   * starts. `vite preview` falls back to `index.html` for unknown paths, so deep
   * links (`page.goto('/invoices/new')`) still land on the SPA, and it serves
   * `public/`, so MSW's `mockServiceWorker.js` is there as it is in dev.
   * `dist-e2e` keeps this bundle apart from a real `dist` build.
   *
   * Locally the dev server stays: it starts instantly and picks up edits.
   * `reuseExistingServer` keeps one already running on :3000 during local
   * iteration, and refuses to in CI, where a stale server would silently test
   * the wrong build.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? `pnpm exec vite build --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${port} --strictPort`
          : `pnpm exec vite --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        // MSW serves the fixture corpus; nothing reaches a backend. Read at
        // build time in CI and by the dev server locally. A local live run
        // (`E2E_LIVE=1` with `E2E_API_URL`) serves the console against that
        // API instead — the release workflow never gets here, it sets
        // `E2E_BASE_URL` to the deployed frontend.
        env:
          live && process.env.E2E_API_URL
            ? { VITE_USE_MOCKS: 'false', VITE_FLEXPRICE_API_URL: process.env.E2E_API_URL }
            : { VITE_USE_MOCKS: 'true' },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

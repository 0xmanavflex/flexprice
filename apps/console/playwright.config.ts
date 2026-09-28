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
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',

  // A flaky test is a broken test (`e2e/AGENTS.md`), so a retry is not allowed
  // to turn one green. If a test needs a retry to pass, that is the finding.
  retries: 0,
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        // Read by the CI step that names the failing journeys, rather than
        // reporting "the suite failed" and making someone open the run to
        // learn which surface broke.
        ['json', { outputFile: 'playwright-results.json' }],
      ]
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
   * the runner must not shadow with a server of its own. `reuseExistingServer`
   * keeps a dev server already running on :3000 during local iteration, and
   * refuses to in CI, where a stale server would silently test the wrong build.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter console dev',
        url: 'http://localhost:3000',
        // MSW serves the fixture corpus; nothing reaches a backend.
        env: { VITE_USE_MOCKS: 'true' },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

import { defineConfig, devices } from '@playwright/test'

/**
 * Visual regression: one viewport screenshot per route, compared against a
 * committed baseline.
 *
 * Why this exists. Typecheck, lint, Storybook a11y and the journeys were all
 * green while the rendered UI drifted from the reference design, because
 * nothing compared pixels. A change to a shared composition or `styles.css`
 * that moves pixels now fails here and names the pages that moved.
 *
 * Same system under test as the journeys (`playwright.config.ts`): the mocked
 * build, `VITE_USE_MOCKS=true`, MSW serving the fixture corpus. Same
 * `E2E_BASE_URL` convention too — set it and no server is started.
 *
 * Everything that can make a pixel differ between machines is pinned here:
 * viewport, device scale factor, locale, timezone, colour scheme, reduced
 * motion. The clock is frozen per test (`e2e/visual/visual.spec.ts`).
 *
 * Baselines are generated on Linux chromium, which is what CI runs, and are
 * stored without a platform suffix. Regenerating them on macOS or Windows would
 * produce different anti-aliasing and fail CI — use CI's container or a Linux
 * machine. See `e2e/visual/README.md`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e/visual',

  // Same stance as the journeys: a retry must not turn a pixel diff green.
  retries: 0,
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // Platform-independent on purpose: `{arg}{ext}` rather than the default
  // `{arg}-{projectName}-{platform}{ext}`. One baseline per route, generated on
  // the same OS CI runs.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',

  reporter: process.env.CI
    ? // `github` turns each failure into a check annotation, readable without the log.
      [['list'], ['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],

  expect: {
    // Readiness waits (heading, first row) cover a cold route compile on the dev
    // server, which can pass 5s when two workers hit it at once. Not a pixel
    // tolerance: a screenshot still has to match.
    timeout: 20_000,
    toHaveScreenshot: {
      // 1% of the viewport tolerates sub-pixel font noise and nothing a person
      // would call a layout change.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // Failure artifacts: the actual / expected / diff images land in
    // `test-results/`, which CI uploads.
    trace: 'retain-on-failure',
  },

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter console dev',
        url: 'http://localhost:3000',
        env: { VITE_USE_MOCKS: 'true' },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
})

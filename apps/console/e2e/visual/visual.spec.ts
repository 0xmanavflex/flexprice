import { expect, test, type Page } from '@playwright/test'

import { VISUAL_CONTRACTS, type Ready } from './routes'
import { skipAnnouncements } from '../fixtures'

/**
 * Screenshot regression: each contract in `routes.ts` is opened, settled and
 * compared against its committed baseline. Rationale and the update rules are
 * in `README.md`; the pinned environment is in `playwright.visual.config.ts`.
 *
 * Determinism is the whole game here. A screenshot suite that flakes gets
 * muted, and a muted suite is no better than the nothing it replaced. So
 * everything that varies between runs is pinned or neutralised before the
 * capture:
 *
 *  - the clock — `Date` is frozen, so "3 days ago" and the mock's
 *    "relative to now" rows (`subs_recent_*`, the events window) never move;
 *  - fonts, network and the first data row — the capture waits for them rather
 *    than for a duration;
 *  - motion — CSS animation/transition are switched off, the caret and the
 *    scrollbars are hidden. JS-driven chart entrances are not CSS, and are
 *    handled by `toHaveScreenshot` itself, which keeps capturing until two
 *    consecutive frames are identical before it compares.
 */

/** The instant every page believes it is. Noon UTC, mid-month, away from edges. */
const FROZEN_NOW = new Date('2026-10-01T12:00:00Z')

const NEUTRALISE = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
`

/** The mock demo session (see `shell.spec.ts`); the guard needs one even under mocks. */
async function signIn(page: Page) {
  await skipAnnouncements(page)
  await page.context().addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
}

async function waitForReady(page: Page, ready: Ready) {
  if (ready.heading !== undefined) {
    await expect(page.getByRole('heading', { name: ready.heading }).first()).toBeVisible()
  }
  if (ready.text !== undefined) {
    // Exact: a line-clamped changelog blurb contains these words and Playwright
    // treats the whole paragraph as hidden, so a substring match never settles.
    await expect(page.getByText(ready.text, { exact: true }).first()).toBeVisible()
  }
  if (ready.rows) {
    // Row 0 is the header; the first data row is what proves the grid loaded.
    await expect(page.getByRole('row').nth(1)).toBeVisible()
  }
}

/** Everything that must be true before a frame is worth comparing. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: NEUTRALISE })
}

async function open(page: Page, route: string, ready: Ready, authenticated = true) {
  if (authenticated) await signIn(page)
  await page.clock.setFixedTime(FROZEN_NOW)
  await page.goto(route)
  await waitForReady(page, ready)
  await settle(page)
}

test.describe('visual: routes', () => {
  for (const contract of VISUAL_CONTRACTS) {
    test(contract.name, async ({ page }) => {
      await open(page, contract.route, contract.ready, !contract.unauthenticated)
      await expect(page).toHaveScreenshot(`${contract.name}.png`, { fullPage: false })
    })
  }
})

/**
 * The open states of the shell's shared surfaces — menus, popovers, a dialog.
 * They are composed once and appear on every page, so a regression here moves
 * every page; and they only exist while open, which a route capture never sees.
 */
test.describe('visual: shared surfaces', () => {
  test('account menu', async ({ page }) => {
    await open(page, '/customers', { heading: 'Customers', rows: true })
    await page.getByRole('button', { name: /^Account:/ }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page).toHaveScreenshot('surface-account-menu.png', { fullPage: false })
  })

  test('environment menu', async ({ page }) => {
    await open(page, '/customers', { heading: 'Customers', rows: true })
    await page.getByRole('button', { name: /Change environment/ }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page).toHaveScreenshot('surface-environment-menu.png', { fullPage: false })
  })

  test('create menu', async ({ page }) => {
    await open(page, '/customers', { heading: 'Customers', rows: true })
    await page.getByRole('button', { name: 'Create something new' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page).toHaveScreenshot('surface-create-menu.png', { fullPage: false })
  })

  test('list filter popover', async ({ page }) => {
    await open(page, '/customers', { heading: 'Customers', rows: true })
    // The list opens with its default "Active" filter; the trigger must say so,
    // or the default has gone missing.
    await page.getByRole('button', { name: 'Filter. 1 active', exact: true }).click()
    await expect(page.getByRole('dialog').or(page.getByRole('menu')).first()).toBeVisible()
    await expect(page).toHaveScreenshot('surface-filter-popover.png', { fullPage: false })
  })

  test('row actions menu', async ({ page }) => {
    await open(page, '/plans', { heading: 'Plans', rows: true })
    await page.getByRole('button', { name: 'Row actions' }).first().click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page).toHaveScreenshot('surface-row-actions-menu.png', { fullPage: false })
  })

  test('form dialog', async ({ page }) => {
    await open(page, '/api-keys', { text: 'Create API key' })
    await page.getByRole('button', { name: 'Create API key' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveScreenshot('surface-form-dialog.png', { fullPage: false })
  })
})

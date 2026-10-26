import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * The customer's Activity tab: the full audit trail, filtered on the server,
 * with an event-details sheet. Against the mock log, where a customer's
 * creation is made by a person in the dashboard and its invoices by the
 * billing workflow.
 *
 * The clock is pinned: the fixtures are dated, and the tab asks the API for
 * the last 30 days, so a real clock would walk them out of the window.
 */
const CUSTOMER = 'cus_synth_0000'

test.beforeEach(async ({ context, page }) => {
  await page.clock.setFixedTime(new Date('2026-09-20T12:00:00Z'))
  await context.addInitScript(
    (value) => {
      try {
        window.localStorage.setItem('flexprice.session', value)
      } catch {
        /* private-mode browser: the guard falls back to sign-in, tested elsewhere */
      }
    },
    JSON.stringify({ token: 'mock_demo_token', userId: 'user_demo', tenantId: 'tenant_demo' }),
  )
})

const events = (page: Page) =>
  page.getByRole('list', { name: 'Activity events' }).getByRole('listitem')

test('lists who did what to which record, with the zone named', async ({ page }) => {
  await page.goto(`/customers/${CUSTOMER}?tab=activity`)
  await expect(page.getByRole('tab', { name: 'Activity', selected: true })).toBeVisible()

  const created = events(page).filter({ hasText: 'Customer created' })
  await expect(created).toHaveCount(1)
  // The actor and the subject are separate: the record under the title, the
  // person in their own column, with the channel.
  await expect(created).toContainText('Customer ·')
  await expect(created).toContainText('demo@flexprice.io')
  await expect(created).toContainText('Dashboard')
  // Invoices come from the billing workflow, not a person.
  await expect(events(page).filter({ hasText: 'Invoice created' }).first()).toContainText(
    'Billing workflow',
  )
  await expect(page.getByText(/^Showing 1–\d+/)).toBeVisible()
})

test('opens an event with its subject, state and request metadata', async ({ page }) => {
  await page.goto(`/customers/${CUSTOMER}?tab=activity`)
  const created = events(page).filter({ hasText: 'Customer created' })
  await created.getByRole('button', { name: /^Open details: Customer created/ }).click()

  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Customer created' })).toBeVisible()
  await expect(sheet.getByText('Subject')).toBeVisible()
  await expect(sheet.getByText('Event metadata')).toBeVisible()
  await expect(sheet.getByText('Request ID')).toBeVisible()
  await expect(sheet.getByText('IP address')).toBeVisible()
  await expect(sheet.getByText(/UTC$/).first()).toBeVisible()
  // The whole snapshot only on request.
  await expect(sheet.locator('pre')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'View raw payload' }).click()
  await expect(sheet.locator('pre')).toContainText('"action": "customer.created"')
})

test('filters by actor on the server and by text on the page', async ({ page }) => {
  await page.goto(`/customers/${CUSTOMER}?tab=activity`)
  await expect(events(page).filter({ hasText: 'Customer created' })).toHaveCount(1)

  const asked = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/activity') &&
      (request.postDataJSON() as { actor_types?: string[] }).actor_types?.[0] === 'system',
  )
  await page.getByRole('combobox', { name: 'Actor' }).click()
  await page.getByRole('option', { name: 'System' }).click()
  await asked
  await expect(events(page).filter({ hasText: 'Customer created' })).toHaveCount(0)

  await page.getByRole('searchbox', { name: 'Search activity' }).fill('no such event anywhere')
  await expect(page.getByText('No activity matches')).toBeVisible()
})

test('the overview card links to the full trail', async ({ page }) => {
  await page.goto(`/customers/${CUSTOMER}`)
  await page.getByRole('button', { name: 'View all activity' }).click()
  await expect(page).toHaveURL(/tab=activity/)
  await expect(page.getByRole('list', { name: 'Activity events' })).toBeVisible()
})

test('the overview card shows events at a glance and opens one in the drawer', async ({ page }) => {
  await page.goto(`/customers/${CUSTOMER}`)
  const card = page.getByRole('region', { name: 'Activity history' })
  await expect(card.getByText('By demo@flexprice.io · Dashboard')).toBeVisible()
  // The card holds no label/value rows: the details are a click away.
  await expect(card.getByText('Tax treatment')).toHaveCount(0)
  await card.getByRole('button', { name: 'Customer created' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Event metadata')).toBeVisible()
  await expect(sheet.getByText('Tax treatment')).toBeVisible()
})

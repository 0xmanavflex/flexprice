import { expect, test, type Page } from '@playwright/test'

import { CatalogListPage } from './pages/catalog'

test.beforeEach(async ({ context }) => {
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

/**
 * Features are created and edited on full pages, renamed inline in the name cell,
 * and cloned / deleted from the row menu. The mock
 * echoes writes back, so these assert the request each action sends and the
 * dialog closing.
 */
test.describe('the features list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Features', searchLabel: 'Search features' })

  const openRowMenu = async (page: Page, item: string) => {
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a metered feature on a full page, step by step', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New feature' }).first().click()
    await expect(page).toHaveURL(/\/features\/new/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const next = page.getByRole('button', { name: 'Next' })
    await next.click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Image renders')
    await expect(page.getByLabel('Lookup key')).toHaveValue('feat-image-renders')
    await next.click()
    await next.click()
    await page.getByLabel('Event name').fill('image_render')
    await next.click()
    await next.click()

    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/v1/features'),
    )
    await page.getByRole('button', { name: 'Create feature' }).click()
    await request
    await expect(page).toHaveURL(/\/features\/(?!new)[^/]+$/)
  })

  test('edits a feature on its own page, with the lookup key read-only', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Edit feature')
    await expect(page).toHaveURL(/\/features\/[^/]+\/edit/)
    await expect(page.getByLabel('Lookup key')).toHaveAttribute('readonly', '')

    await page.getByLabel('Description').fill('Updated from the edit page')
    const request = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/v1\/features\/[^/]+$/.test(new URL(r.url()).pathname),
    )
    await page.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(page).not.toHaveURL(/\/edit/)
  })

  test('renames a feature inline', async ({ page }) => {
    await page.goto('/features')
    const first = list(page).rows().first()
    await expect(first).toBeVisible({ timeout: 45_000 })

    await first.getByRole('button', { name: /^Feature: .*Edit$/ }).click()
    const input = first.getByRole('textbox', { name: 'Feature' })
    await input.fill('Renamed feature')

    const request = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/v1\/features\/[^/]+$/.test(new URL(r.url()).pathname),
    )
    await input.press('Enter')
    await request
    await expect(first.getByRole('textbox', { name: 'Feature' })).toBeHidden()
  })

  test('clones a feature under a new name', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Clone feature')
    const dialog = page.getByRole('dialog', { name: 'Clone feature' })
    await dialog.getByLabel('Lookup key').fill('cloned_key')

    const request = page.waitForRequest(
      (r) =>
        r.method() === 'POST' && /\/v1\/features\/[^/]+\/clone$/.test(new URL(r.url()).pathname),
    )
    await dialog.getByRole('button', { name: 'Create copy' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('deletes a feature after confirming', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Delete feature')
    const dialog = page.getByRole('dialog', { name: 'Delete feature' })

    const request = page.waitForRequest(
      (r) => r.method() === 'DELETE' && /\/v1\/features\/[^/]+$/.test(new URL(r.url()).pathname),
    )
    await dialog.getByRole('button', { name: 'Delete feature' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('opens the create page from /features/new and edits from the detail page', async ({
    page,
  }) => {
    await page.goto('/features/new')
    await expect(page.getByRole('heading', { name: 'Create feature' })).toBeVisible()

    await page.goto('/features')
    await list(page).rows().first().getByRole('cell').nth(2).click()
    await expect(page).toHaveURL(/\/features\/[^/?#]+$/)

    // Header Edit is in place: fields become inputs, the URL does not change.
    const url = page.url()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page).toHaveURL(url)
    await page.getByRole('button', { name: 'Cancel' }).click()

    // The multi-step configuration is the dedicated flow.
    await page.getByRole('button', { name: 'Edit configuration' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  })
})

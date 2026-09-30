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
 * Features are created and edited in place: a dialog over the list, an inline
 * rename in the name cell, and Edit / Clone / Delete from the row menu. The mock
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

  test('creates a metered feature from a dialog', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New feature' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'New feature' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Create feature' }).click()
    await expect(dialog.getByText('Enter a name')).toBeVisible()

    await dialog.getByLabel('Name', { exact: false }).first().fill('Image renders')
    await expect(dialog.getByLabel('Lookup key')).toHaveValue('feat-image-renders')
    await dialog.getByLabel('Event name').fill('image_render')

    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/v1/features'),
    )
    await dialog.getByRole('button', { name: 'Create feature' }).click()
    await request
    await expect(dialog).toBeHidden()
  })

  test('edits a feature from the row menu, with the meter read-only', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await openRowMenu(page, 'Edit feature')
    const dialog = page.getByRole('dialog', { name: 'Edit feature' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Lookup key')).toHaveAttribute('readonly', '')

    await dialog.getByLabel('Description').fill('Updated from the dialog')
    const request = page.waitForRequest(
      (r) => r.method() === 'PUT' && /\/v1\/features\/[^/]+$/.test(new URL(r.url()).pathname),
    )
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await request
    await expect(dialog).toBeHidden()
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

  test('opens the create dialog from /features/new and edits from the detail page', async ({
    page,
  }) => {
    await page.goto('/features/new')
    await expect(page.getByRole('dialog', { name: 'New feature' })).toBeVisible()

    await page.goto('/features')
    await list(page).rows().first().getByRole('cell').nth(2).click()
    await expect(page).toHaveURL(/\/features\/[^/?#]+$/)
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('dialog', { name: 'Edit feature' })).toBeVisible()
  })
})

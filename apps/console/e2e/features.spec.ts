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
 * Features are created and edited on full pages,
 * and cloned / deleted from the row menu. The mock
 * echoes writes back, so these assert the request each action sends and the
 * dialog closing.
 */
test.describe('the features list', () => {
  const list = (page: Page) =>
    new CatalogListPage(page, { heading: 'Features', searchLabel: 'Search features' })

  const openRowMenu = async (page: Page, item: string) => {
    /*
     * Wait for the linkage columns before opening a menu.
     *
     * The list renders its rows, then fills the plan and entitlement counts
     * from a second fan-out of requests. That arrival re-renders every row,
     * including the trigger of an open dropdown, and the menu goes with it —
     * so a click placed in the gap finds nothing and spends the whole timeout
     * looking. It cost two CI runs, a different features journey each time,
     * which is what a race looks like from the outside.
     */
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
    await list(page).rows().first().getByRole('button', { name: 'Row actions' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.getByRole('menuitem', { name: item }).click()
  }

  test('creates a metered feature on a single full page', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })

    await page.getByRole('button', { name: 'New feature' }).first().click()
    await expect(page).toHaveURL(/\/features\/new/)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Type comes first (Metered preselected); the whole form is one page, no Next step.
    await expect(page.getByRole('radio', { name: /Metered/ })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)

    const create = page.getByRole('button', { name: 'Create feature' })
    await create.click()
    await expect(page.getByText('Enter a name')).toBeVisible()

    await page.getByLabel('Name', { exact: false }).first().fill('Image renders')
    await expect(page.getByLabel('Lookup key')).toHaveValue('feat-image-renders')
    await page.getByLabel('Event name').fill('image_render')

    const request = page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/v1/features'),
    )
    await create.click()
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

  test('opens the create page at /features/new', async ({ page }) => {
    await page.goto('/features/new')
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
  })

  test('edits from the detail page', async ({ page }) => {
    await page.goto('/features')
    await expect(list(page).rows().first()).toBeVisible({ timeout: 45_000 })
    await list(page).rows().first().getByRole('cell').nth(2).click()
    await expect(page).toHaveURL(/\/features\/[^/?#]+$/)

    // Information is the create form's own shape, locked: the same cards, the
    // same labels, the same order — and no second, smaller editor beside the
    // real one. So the tab reads, and nothing on it offers to edit.
    const url = page.url()
    await page.getByRole('tab', { name: 'Information' }).click()
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
    // The shared rail's metadata card keeps its own Edit; the form cards have none.
    await expect(page.getByRole('button', { name: /^Edit (?!metadata)/ })).toHaveCount(0)
    await expect(page).toHaveURL(url)

    // Editing is the one place it was always meant to be.
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await expect(page).toHaveURL(/\/edit$/)
  })
})

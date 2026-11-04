import { expect, test } from './fixtures'

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
 * Create with AI from a template, as V1 runs it: a template sent as written is
 * its own schema, so the model is never asked, and creating it lands on Plans.
 */
test('a template creates its pricing without asking the model', async ({ page }) => {
  const parses: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/ai/pricing/parse-gemini'))
      parses.push(request.url())
  })

  await page.goto('/plans')
  await page.getByRole('button', { name: 'Create with AI' }).first().click({ timeout: 20_000 })
  await expect(page).toHaveURL(/\/plans\/ai$/)

  await page.getByRole('radio', { name: /Railway/ }).click()
  await page.getByRole('button', { name: 'Generate pricing' }).click()
  const create = page.getByRole('button', { name: 'Create all of this' })
  await expect(create).toBeEnabled({ timeout: 20_000 })
  expect(parses).toEqual([])

  await create.click()
  await expect(page).toHaveURL(/\/plans$/, { timeout: 30_000 })
  await expect(page.getByText('Your pricing has been created')).toBeVisible()
})

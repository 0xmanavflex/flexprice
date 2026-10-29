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

const isSave = (r: { method(): string; url(): string }) =>
  r.method() === 'PUT' && /\/settings\/bonus_credits_topup_config$/.test(new URL(r.url()).pathname)

test('bonus credit slabs save highest first, with gte and their expiry', async ({ page }) => {
  await page.goto('/settings?section=alerts&tab=bonus-credits')
  await expect(page.getByRole('tab', { name: 'Bonus credits' })).toBeVisible()

  await page.getByRole('switch', { name: 'Bonus credits' }).click()
  // On with no slabs is refused here, before the API would.
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Add at least one slab, or turn bonus credits off')).toBeVisible()

  await page.getByRole('button', { name: 'Add slab' }).click()
  await page.getByRole('textbox', { name: 'Slab 1 top-up of at least' }).fill('100')
  await page.getByRole('combobox', { name: 'Slab 1 bonus type' }).click()
  await page.getByRole('option', { name: 'Credits' }).click()
  await page.getByRole('textbox', { name: 'Slab 1 bonus', exact: true }).fill('50')

  await page.getByRole('button', { name: 'Add slab' }).click()
  await page.getByRole('textbox', { name: 'Slab 2 top-up of at least' }).fill('200')
  await page.getByRole('textbox', { name: 'Slab 2 bonus', exact: true }).fill('10')
  await page.getByRole('textbox', { name: 'Slab 2 bonus expires after' }).fill('3')

  await expect(
    page.getByText('From 200 credits: 10% of the top-up, expires 3 months after the top-up.'),
  ).toBeVisible()

  const [request] = await Promise.all([
    page.waitForRequest(isSave),
    page.getByRole('button', { name: 'Save changes' }).click(),
  ])
  expect(request.postDataJSON()).toEqual({
    value: {
      enabled: true,
      slabs: [
        {
          threshold: '200',
          operator: 'gte',
          bonus: { type: 'percentage', value: '10' },
          expiration_duration: 3,
          expiration_duration_unit: 'MONTH',
        },
        { threshold: '100', operator: 'gte', bonus: { type: 'flat', value: '50' } },
      ],
    },
  })
  await expect(page.getByText('Saved.')).toBeVisible()
})

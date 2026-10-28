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

test('creates, tops up and terminates a wallet', async ({ page }) => {
  await page.goto('/customers')
  await page.getByRole('row').nth(1).getByRole('cell').first().click()
  await expect(page).toHaveURL(/\/customers\/[^/?]+/)
  await page.getByRole('tab', { name: 'Wallet' }).click()

  await expect(page.getByText('No wallet yet')).toBeVisible()
  await page.getByRole('button', { name: 'Create wallet' }).click()
  const create = page.getByRole('dialog', { name: 'Create wallet' })
  await create.getByLabel('Conversion rate').fill('0.01')
  // Exact: the dialog also has "Initial credits expire on", which a substring
  // match picks up as well.
  await create.getByLabel('Initial credits', { exact: true }).fill('1000')
  await create.getByRole('button', { name: 'Create wallet' }).click()

  await expect(page.getByText('Consumption rate')).toBeVisible()
  await expect(page.getByText('1,000 credits').first()).toBeVisible()

  await page.getByRole('button', { name: 'Top up wallet' }).click()
  const topUp = page.getByRole('dialog', { name: 'Top up wallet' })
  await topUp.getByRole('button', { name: 'Top up' }).click()
  await expect(topUp.getByRole('alert')).toContainText('positive number of credits')
  await topUp.getByLabel('Credits').fill('250')
  await topUp.getByRole('button', { name: 'Top up' }).click()
  await expect(page.getByText('1,250 credits').first()).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Transactions table' }).getByText('Purchased credits'),
  ).toBeVisible()

  await page.getByRole('button', { name: /auto top-up off/i }).click()
  const auto = page.getByRole('dialog', { name: 'Auto top-up' })
  await auto.getByRole('switch', { name: 'Top up automatically' }).click()
  await auto.getByRole('button', { name: 'Save' }).click()
  await expect(auto.getByRole('alert')).toContainText('credit balance that triggers')
  await auto.getByLabel('Below').fill('100')
  await auto.getByLabel('Add').fill('500')
  await auto.getByRole('button', { name: 'Save' }).click()
  // The Auto top-up property now summarises the rule it runs.
  await expect(page.getByRole('button', { name: /auto top-up on/i })).toContainText(
    'Below $100, add $500',
  )

  await page.getByRole('button', { name: 'Wallet actions' }).click()
  await page.getByRole('menuitem', { name: 'Terminate wallet' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Terminate wallet' }).click()
  await expect(page.getByText('Terminated', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Top up wallet' })).toBeDisabled()
})

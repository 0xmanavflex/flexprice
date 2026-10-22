import { expect, test } from '@playwright/test'

/**
 * The customer portal surface (`/p`), opened from its link. The mocks answer
 * as the API does, so a request the API would refuse fails here too.
 */
test('the Credits tab lists top-ups, asking for credits as the API spells them', async ({
  page,
}) => {
  const types: (string | null)[] = []
  page.on('request', (request) => {
    if (request.url().includes('/transactions'))
      types.push(new URL(request.url()).searchParams.get('type'))
  })
  await page.goto('/p/credits?token=mock_portal_token')
  await expect(page.getByRole('heading', { name: 'Top-ups' }).first()).toBeVisible()
  await expect(page.getByText('Credits purchased')).toBeVisible()
  // The API takes `credit` / `debit`; `CREDIT` is a 400.
  expect(types).toContain('credit')
  expect(types).not.toContain('CREDIT')
})

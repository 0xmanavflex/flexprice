import { expect, test } from './fixtures'

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

test('the transaction history loads ten at a time, and the totals cover every page', async ({
  page,
}) => {
  const offsets: (string | null)[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/transactions') && url.searchParams.get('limit') === '10')
      offsets.push(url.searchParams.get('offset'))
  })
  await page.goto('/p/credits?token=mock_portal_token')
  // Added and Used sum all 16 transactions, though the history loads ten at first.
  await expect(page.getByText('$700.00')).toBeVisible()
  await expect(page.getByText('$498.00')).toBeVisible()

  await page.getByRole('tab', { name: 'All transactions' }).click()
  const history = page.getByRole('list').filter({ hasText: 'INV-2026-01512' })
  await expect(history.getByRole('listitem')).toHaveCount(10)

  // The first ten are all payments: Added finds none yet, and still offers the next page.
  await page.getByRole('tab', { name: 'Added' }).click()
  await expect(
    page.getByText('None in the transactions loaded so far', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(page.getByText('Auto top-up · Visa •••• 4242')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0)
  expect(offsets).toEqual(['0', '10'])
})

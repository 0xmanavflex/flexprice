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

test('the transaction history loads a page at a time, and Load more reaches past a filter', async ({
  page,
}) => {
  const offsets: (string | null)[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/transactions') && url.searchParams.get('limit') === '10')
      offsets.push(url.searchParams.get('offset'))
  })
  await page.goto('/p/credits?token=mock_portal_token')
  await page.getByRole('tab', { name: 'All transactions' }).click()
  const history = page.getByRole('region', { name: 'Transaction history' })
  const rows = history.getByRole('listitem')
  const more = history.getByRole('button', { name: 'Load more' })

  // The first page: ten rows, and a way to the next.
  await expect(rows).toHaveCount(10)
  await expect(more).toBeVisible()

  // A direction filter works on what is loaded; while pages remain, Load more stays.
  await page.getByRole('tab', { name: 'Added' }).click()
  await expect(more).toBeVisible()
  const before = await rows.count()
  await more.click()
  await expect.poll(() => rows.count()).toBeGreaterThan(before)

  // Each Load more asks for the next page by offset, not the list again from the top.
  expect(offsets).toEqual(['0', '10'])
})

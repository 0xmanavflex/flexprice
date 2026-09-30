import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CouponGrid } from './CouponGrid'
import { couponFixtures, fixtureCouponQuery, manyCoupons } from './couponFixtures'

/**
 * Wait for an open popup to finish unmounting.
 *
 * While a Base UI popup is open it mounts `data-base-ui-focus-guard` spans
 * that are `aria-hidden` *and* `tabindex="0"` — which is exactly what axe's
 * `aria-hidden-focus` rule forbids. The a11y scan runs when the play function
 * returns, so a story that returns while the popup is still closing is scanned
 * mid-animation and fails intermittently. This is not a suppression: it makes
 * the scan look at the settled DOM, which is the state being asserted about.
 */
async function popupClosed(role: 'menu' | 'listbox') {
  await waitFor(() => expect(within(document.body).queryByRole(role)).toBeNull())
}

const meta = {
  title: 'Surfaces/CouponGrid',
  component: CouponGrid,
  parameters: { layout: 'padded' },
  args: {
    coupons: couponFixtures,
    total: couponFixtures.length,
    query: fixtureCouponQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof CouponGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Launch 20% off')).toBeInTheDocument()

    // A percentage prints the API's own string; a fixed amount goes through
    // formatMoney. Neither is computed here — money.ts forbids the arithmetic.
    await expect(canvas.getByText('20%')).toBeInTheDocument()
    await expect(canvas.getByText('$50.00')).toBeInTheDocument()

    // Only `repeated` reads with a count beside it, and the unit is periods —
    // not months, which the cadence does not say.
    await expect(canvas.getByText('Repeating · 3 periods')).toBeInTheDocument()
    await expect(canvas.getAllByText('One-time').length).toBeGreaterThan(0)

    // A null ceiling is unlimited, said out loud rather than left blank.
    await expect(canvas.getByText('213 / 500')).toBeInTheDocument()
    await expect(canvas.getByText('87 / Unlimited')).toBeInTheDocument()
  },
}

/**
 * Expiry is a date, not a status.
 *
 * `CouponStatus` is published|archived, so the dropdown offers what the server
 * can actually count. An "Expired" option would have to be counted off the
 * twenty-five rows on screen while every other option carried a server total.
 */
export const NoExpiredOption: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Launch 20% off')

    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    await expect(listbox.queryByRole('option', { name: /expired/i })).toBeNull()
    await expect(listbox.getByRole('option', { name: /archived/i })).toBeInTheDocument()

    // Close it before the a11y scan runs — see `popupClosed`.
    await userEvent.keyboard('{Escape}')
    await popupClosed('listbox')
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Launch 20% off')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

/** The status dropdown carries the server's counts and writes the query. */
export const StatusDropdown: Story = {
  args: { statusCounts: { total: 42, published: 31, archived: 11 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    await expect(listbox.getByText('31')).toBeInTheDocument()
    await userEvent.click(listbox.getByRole('option', { name: /archived/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() =>
      expect(
        spy.mock.calls
          .map((call) => call[0] as { statuses?: string[] })
          .some((query) => query.statuses?.[0] === 'archived'),
      ).toBe(true),
    )
    await popupClosed('listbox')
  },
}

export const Loading: Story = { args: { coupons: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    coupons: [],
    total: 0,
    query: { ...fixtureCouponQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no coupons match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing created yet: the illustration, the CTA, and three guide cards. */
export const FirstRun: Story = {
  args: { coupons: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No coupons yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    coupons: [],
    total: 0,
    error: 'You do not have access to coupons in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Paging reports a page number, never an offset, and never drops a query key. */
export const PaginationReportsDomainQuery: Story = {
  args: { coupons: manyCoupons(25), total: 120, query: { ...fixtureCouponQuery, page: 1 } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureCouponQuery).sort())
  },
}

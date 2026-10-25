import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { CouponGrid } from './CouponGrid'
import { couponFixtures, fixtureCouponQuery, manyCoupons } from './couponFixtures'

const meta = {
  title: 'App/Settings/Discounts/Discount table',
  component: CouponGrid,
  parameters: { layout: 'padded' },
  args: {
    coupons: couponFixtures,
    total: couponFixtures.length,
    query: fixtureCouponQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    coupons: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onCouponClick: { control: false },
    onCreate: { control: false },
    onEdit: { control: false },
    onArchive: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof CouponGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof CouponGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function CouponGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...fixtureCouponQuery, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <CouponGrid
      {...args}
      coupons={manyCoupons(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to coupons in this environment.' : null}
    />
  )
}

/** Drag `rows` from 0 to 60 to see first-run, a short list and paging; toggle loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { rows: 30, hasError: false, page: 1, pageSize: 10, isLoading: false },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    hasError: { control: 'boolean' },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
  },
  render: (args) => <CouponGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Launch 20% off')).toBeInTheDocument()

    // A percentage prints the API's own string; a fixed amount goes through
    // formatMoney. Neither is computed here: money.ts forbids the arithmetic.
    await expect(canvas.getByText('20%')).toBeInTheDocument()
    await expect(canvas.getByText('$50.00')).toBeInTheDocument()

    // Only `repeated` reads with a count beside it, and the unit is periods:
    // not months, which the cadence does not say.
    await expect(canvas.getByText('Repeating · 3 periods')).toBeInTheDocument()
    await expect(canvas.getAllByText('One-time').length).toBeGreaterThan(0)

    // A null ceiling is unlimited, said out loud rather than left blank.
    await expect(canvas.getByText('213 / 500')).toBeInTheDocument()
    await expect(canvas.getByText('87 / Unlimited')).toBeInTheDocument()
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

export const Loading: Story = { args: { coupons: [], total: 0, isLoading: true } }

/** A filter emptied the list: the toolbar survives, so it can be undone. */
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

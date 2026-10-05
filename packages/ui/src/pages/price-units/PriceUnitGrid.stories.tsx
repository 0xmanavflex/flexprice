import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { PriceUnitGrid } from './PriceUnitGrid'
import { fixturePriceUnitQuery, manyPriceUnits, priceUnitFixtures } from './priceUnitFixtures'

const meta = {
  title: 'Surfaces/PriceUnitGrid',
  component: PriceUnitGrid,
  parameters: { layout: 'padded' },
  args: {
    priceUnits: priceUnitFixtures,
    total: priceUnitFixtures.length,
    query: fixturePriceUnitQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof PriceUnitGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Credits')).toBeInTheDocument()

    // The rate reads as an equation, and the string the API sent is printed
    // verbatim — parsing it to a number to reformat would throw away the
    // precision the string exists to preserve.
    await expect(canvas.getByText('1 CRD = 0.01 USD')).toBeInTheDocument()
    await expect(canvas.getByText('1 TOK = 0.0000025 USD')).toBeInTheDocument()
    await expect(canvas.getByText('1 EUC = 0.02 EUR')).toBeInTheDocument()
  },
}

/**
 * No status dropdown — status is a column and an entry in the filter popover.
 *
 * A tenant has a handful of price units, and the Status column says what a
 * dropdown would. Asserted so the toolbar does not quietly regrow one; the
 * filter button stays, because the status filter lives behind it.
 */
export const NoStatusDropdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Credits')

    await expect(canvas.queryByRole('combobox', { name: /status/i })).toBeNull()
    await expect(canvas.getByRole('button', { name: /filter/i })).toBeInTheDocument()

    // Search and sort remain, and so does the Status column.
    await expect(canvas.getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
    await expect(canvas.getByPlaceholderText(/search price units/i)).toBeInTheDocument()
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Credits')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

export const Loading: Story = { args: { priceUnits: [], total: 0, isLoading: true } }

/** A filter emptied the list — the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    priceUnits: [],
    total: 0,
    query: { ...fixturePriceUnitQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no price units match these filters/i),
    ).toBeInTheDocument()
  },
}

/** Nothing created yet: the illustration, the CTA, and three guide cards. */
export const FirstRun: Story = {
  args: { priceUnits: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No price units yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    priceUnits: [],
    total: 0,
    error: 'You do not have access to price units in this environment.',
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
  args: {
    priceUnits: manyPriceUnits(25),
    total: 120,
    query: { ...fixturePriceUnitQuery, page: 1 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixturePriceUnitQuery).sort())
  },
}

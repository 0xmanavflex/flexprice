import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DEFAULT_PRICE_UNIT_QUERY, type PriceUnitQuery, PriceUnitStatus } from '@fp/domain'
import { PriceUnitGrid } from './PriceUnitGrid'
import { fixturePriceUnitQuery, manyPriceUnits, priceUnitFixtures } from './priceUnitFixtures'

const meta = {
  title: 'App/Settings/Price units/Price unit table',
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
    // verbatim: parsing it to a number to reformat would throw away the
    // precision the string exists to preserve.
    await expect(canvas.getByText('1 CRD = 0.01 USD')).toBeInTheDocument()
    await expect(canvas.getByText('1 TOK = 0.0000025 USD')).toBeInTheDocument()
    await expect(canvas.getByText('1 EUC = 0.02 EUR')).toBeInTheDocument()
  },
}

/**
 * No status dropdown: status is a column and an entry in the filter popover.
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

/** A filter emptied the list: the toolbar survives, so it can be undone. */
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

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof PriceUnitGrid>,
  'priceUnits' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | PriceUnitStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function PriceUnitGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<PriceUnitQuery>({
    ...DEFAULT_PRICE_UNIT_QUERY,
    page,
    pageSize,
  })
  const all = useMemo(() => withStatus(manyPriceUnits(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <PriceUnitGrid
      locale="en-US"
      {...rest}
      priceUnits={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to price units in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(priceUnits|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onPriceUnitClick: fn(),
    onEdit: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(PriceUnitStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <PriceUnitGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

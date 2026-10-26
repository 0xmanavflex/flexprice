import { type ComponentProps, useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  DEFAULT_TAX_RATE_QUERY,
  type TaxRate,
  type TaxRateQuery,
  TaxRateScope,
  TaxRateStatus,
} from '@fp/domain'
import { TaxRateGrid } from './TaxRateGrid'

const meta = {
  title: 'App/Settings/Taxes/Tax rate table',
  component: TaxRateGrid,
  parameters: { layout: 'padded' },
  args: {
    taxRates: taxRateFixtures(),
    total: 4,
    query: { ...DEFAULT_TAX_RATE_QUERY } satisfies TaxRateQuery,
    onQueryChange: fn(),
  },
} satisfies Meta<typeof TaxRateGrid>

export default meta
type Story = StoryObj<typeof meta>

function taxRateFixtures(): TaxRate[] {
  return [
    {
      id: 'tax_01',
      name: 'UK VAT',
      code: 'GB-VAT-20',
      description: 'Standard rate',
      percentageValue: '20',
      scope: TaxRateScope.External,
      status: TaxRateStatus.Published,
      createdAt: new Date('2025-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
    },
    {
      // A fractional rate: rendered from the exact string the API sent, never
      // parsed into a float and formatted back.
      id: 'tax_02',
      name: 'Ontario HST',
      code: 'CA-ON-HST',
      description: 'Harmonised sales tax',
      percentageValue: '13.5',
      scope: TaxRateScope.External,
      status: TaxRateStatus.Published,
      createdAt: new Date('2025-03-11T00:00:00Z'),
      updatedAt: null,
    },
    {
      id: 'tax_03',
      name: 'Platform fee offset',
      code: '',
      description: '',
      percentageValue: '',
      scope: TaxRateScope.Internal,
      status: TaxRateStatus.Published,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: null,
    },
    {
      id: 'tax_04',
      name: 'Legacy GST',
      code: 'AU-GST-10',
      description: 'Retired',
      percentageValue: '10',
      scope: TaxRateScope.OneTime,
      status: TaxRateStatus.Archived,
      createdAt: new Date('2023-07-01T00:00:00Z'),
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    },
  ]
}

/** A deterministic page-worth of tax rates: the fixtures, cycled with unique ids. */
function manyTaxRates(count: number): TaxRate[] {
  const base = taxRateFixtures()
  return Array.from({ length: count }, (_, index) => {
    const item = base[index % base.length] as TaxRate
    return { ...item, id: `tax_page_${index}`, name: `${item.name} ${index}` }
  })
}

export const Default: Story = {}

/** The rate is the API's exact decimal with a sign, not a reparsed float. */
export const RatesAreExact: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('UK VAT')).toBeInTheDocument()
    await expect(canvas.getByText('20%')).toBeInTheDocument()
    await expect(canvas.getByText('13.5%')).toBeInTheDocument()
    await expect(canvas.getByText('One-time')).toBeInTheDocument()
    // The rate with no code and no percentage dashes on both.
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  },
}

/**
 * "Applied to" is not a column.
 *
 * The capability exists: `GET /taxes/associations` takes a `tax_rate_id` and
 * its `pagination.total` is exactly this number: but nothing calls it yet,
 * and a column of zeros would say "this rate applies to nothing" when the
 * truth is "we did not ask".
 */
export const NoAppliedToColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('UK VAT')

    const headers = Array.from(canvasElement.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').trim().toLowerCase(),
    )
    await expect(headers).not.toContain('applied to')
    await expect(headers).toContain('rate %')
    await expect(headers).toContain('scope')
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('UK VAT')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
  },
}

export const Loading: Story = { args: { taxRates: [], total: 0, isLoading: true } }

export const FilteredEmpty: Story = {
  args: {
    taxRates: [],
    total: 0,
    query: { ...DEFAULT_TAX_RATE_QUERY, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no tax rates match these filters/i),
    ).toBeInTheDocument()
  },
}

export const FirstRun: Story = {
  args: { taxRates: [], total: 0, onCreate: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No taxes set up yet')).toBeInTheDocument()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Add tax' })[0]!)
    await expect(args.onCreate).toHaveBeenCalled()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
  },
}

export const Error: Story = {
  args: {
    taxRates: [],
    total: 0,
    error: 'You do not have access to tax rates in this environment.',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

export const PaginationReportsDomainQuery: Story = {
  args: { total: 120 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(await canvas.findByRole('button', { name: /next|go to next page/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    const reportedPage = () =>
      spy.mock.calls.map((call) => call[0] as Record<string, unknown>).find((q) => q['page'] === 2)
    await waitFor(() => expect(reportedPage()).toBeDefined())
    const reported = reportedPage() as Record<string, unknown>
    expect(reported).toMatchObject({ page: 2 })
    expect(Object.keys(reported).sort()).toEqual(Object.keys(DEFAULT_TAX_RATE_QUERY).sort())
  },
}

/** Overrides every row's status so one state can be inspected across a long list. */
function withStatus<T extends { status: unknown }>(items: T[], status: string): T[] {
  return status === 'mixed' ? items : items.map((item) => ({ ...item, status }) as T)
}

type PlaygroundArgs = Omit<
  ComponentProps<typeof TaxRateGrid>,
  'taxRates' | 'total' | 'query' | 'onQueryChange' | 'error'
> & {
  /** How many records the server holds, 0 to 60. */
  rows: number
  /** The page shown, 1-based. */
  page: number
  pageSize: number
  /** Forces every row to one status; mixed keeps the fixture spread. */
  status: 'mixed' | TaxRateStatus
  /** Shows the error state instead of the list. */
  hasError: boolean
}

function TaxRateGridPlayground({
  rows,
  page,
  pageSize,
  status,
  hasError,
  ...rest
}: PlaygroundArgs) {
  const [query, setQuery] = useState<TaxRateQuery>({ ...DEFAULT_TAX_RATE_QUERY, page, pageSize })
  const all = useMemo(() => withStatus(manyTaxRates(rows), status), [rows, status])
  const lastPage = Math.max(1, Math.ceil(all.length / query.pageSize))
  const current = Math.min(query.page, lastPage)
  const start = (current - 1) * query.pageSize
  return (
    <TaxRateGrid
      {...rest}
      taxRates={all.slice(start, start + query.pageSize)}
      total={all.length}
      query={{ ...query, page: current }}
      onQueryChange={setQuery}
      error={hasError ? 'You do not have access to tax rates in this environment.' : null}
    />
  )
}

/** Drag rows from 0 to 60 to walk empty, one page, and a long list; flip loading and error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(taxRates|total|query|error|on[A-Z].*)$/ } },
  args: {
    rows: 30,
    page: 1,
    pageSize: 10,
    status: 'mixed',
    isLoading: false,
    hasError: false,
    onRetry: fn(),
    onCreate: fn(),
    onTaxRateClick: fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
  argTypes: {
    rows: { control: { type: 'number', min: 0, max: 60, step: 1 } },
    page: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    pageSize: { control: 'select', options: [10, 25, 50] },
    status: { control: 'select', options: ['mixed', ...Object.values(TaxRateStatus)] },
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' },
  },
  render: (args) => <TaxRateGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

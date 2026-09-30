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
  title: 'Surfaces/TaxRateGrid',
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
 * The capability exists — `GET /taxes/associations` takes a `tax_rate_id` and
 * its `pagination.total` is exactly this number — but nothing calls it yet,
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

export const StatusDropdown: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: /status/i }))
    const listbox = within(await within(document.body).findByRole('listbox'))
    await userEvent.click(listbox.getByRole('option', { name: /archived/i }))

    const spy = args.onQueryChange as unknown as { mock: { calls: unknown[][] } }
    await waitFor(() =>
      expect(
        spy.mock.calls
          .map((call) => call[0] as { statuses?: string[] })
          .some((query) => query.statuses?.[0] === TaxRateStatus.Archived),
      ).toBe(true),
    )
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No tax rates yet')).toBeInTheDocument()
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

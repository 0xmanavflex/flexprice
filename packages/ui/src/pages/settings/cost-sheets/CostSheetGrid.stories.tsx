import { type ComponentProps, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import {
  type CostSheet,
  type CostSheetQuery,
  CostSheetStatus,
  DEFAULT_COST_SHEET_QUERY,
} from '@fp/domain'
import { CostSheetGrid } from './CostSheetGrid'

/**
 * The cost sheet list, over the shared `EntityList`.
 *
 * Cost sheets as plain domain values: no client, no provider, no network.
 */
const costSheetFixtures: CostSheet[] = [
  {
    id: 'cs_01',
    name: 'AI inference costs',
    lookupKey: 'ai_inference',
    description: 'Per-token model costs across providers',
    priceCount: 12,
    status: CostSheetStatus.Published,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    id: 'cs_02',
    name: 'Telephony',
    lookupKey: 'telephony',
    description: '',
    priceCount: 1,
    status: CostSheetStatus.Published,
    createdAt: new Date('2026-01-12T00:00:00Z'),
    updatedAt: new Date('2026-02-20T00:00:00Z'),
  },
  {
    // No lookup key and no prices yet: the sheet a hand-written demo omits.
    id: 'cs_03',
    name: 'Storage egress',
    lookupKey: '',
    description: 'Bandwidth and object storage',
    priceCount: 0,
    status: CostSheetStatus.Published,
    createdAt: null,
    updatedAt: null,
  },
  {
    // Archived: the muted row.
    id: 'cs_04',
    name: 'Legacy vendor',
    lookupKey: 'legacy_vendor',
    description: 'Retired, kept for reconciliation',
    priceCount: 4,
    status: CostSheetStatus.Archived,
    createdAt: new Date('2025-11-01T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  },
]

const fixtureCostSheetQuery: CostSheetQuery = { ...DEFAULT_COST_SHEET_QUERY }

function manyCostSheets(count: number): CostSheet[] {
  return Array.from({ length: count }, (_, index) => {
    const base = costSheetFixtures[index % costSheetFixtures.length] as CostSheet
    return { ...base, id: `cs_page_${index}`, name: `${base.name} ${index}` }
  })
}

const meta = {
  title: 'App/Settings/Cost sheets/Cost sheet table',
  component: CostSheetGrid,
  parameters: { layout: 'padded' },
  args: {
    costSheets: costSheetFixtures,
    total: costSheetFixtures.length,
    query: fixtureCostSheetQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
  argTypes: {
    costSheets: { control: false },
    total: { control: false },
    query: { control: false },
    isLoading: { control: 'boolean' },
    error: { control: false },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onQueryChange: { control: false },
    onRetry: { control: false },
    onCostSheetClick: { control: false },
    onCreate: { control: false },
    onEdit: { control: false },
    onDelete: { control: false },
    onClearFilters: { control: false },
  },
} satisfies Meta<typeof CostSheetGrid>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof CostSheetGrid> & {
  rows: number
  hasError: boolean
  page: number
  pageSize: number
}

function CostSheetGridPlayground({ rows, hasError, page, pageSize, ...args }: PlaygroundArgs) {
  const [query, setQuery] = useState(() => ({ ...fixtureCostSheetQuery, page, pageSize }))
  const start = (query.page - 1) * query.pageSize
  return (
    <CostSheetGrid
      {...args}
      costSheets={manyCostSheets(rows).slice(start, start + query.pageSize)}
      total={rows}
      query={query}
      onQueryChange={(next) => {
        setQuery(next)
        args.onQueryChange(next)
      }}
      error={hasError ? 'You do not have access to cost sheets in this environment.' : null}
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
  render: (args) => <CostSheetGridPlayground key={`${args.page}-${args.pageSize}`} {...args} />,
}

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('AI inference costs')).toBeInTheDocument()
    // Line items is the count the API gives: the prices themselves were
    // collapsed to a number long before this component saw them.
    await expect(canvas.getByText('12')).toBeInTheDocument()
    // A sheet with no description says so rather than rendering blank.
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
  },
}

/**
 * Provider and Margin target have no field, so they are absent.
 *
 * The redesign's own gap list names both. Margin target is the tempting one,
 * but `money.ts` forbids money arithmetic in the browser and `priceCount` has
 * already collapsed the prices to a count, so there is nothing to compute from
 * even if it were allowed.
 */
export const OmitsUnsourcedColumns: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('AI inference costs')

    await expect(canvas.queryByRole('columnheader', { name: /provider/i })).toBeNull()
    await expect(canvas.queryByRole('columnheader', { name: /margin/i })).toBeNull()
    await expect(canvas.getByRole('columnheader', { name: /line items/i })).toBeInTheDocument()
  },
}

/** The shared table's geometry, as this surface renders it. */
export const Layout: Story = {
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('AI inference costs')

    const header = canvasElement.querySelector('thead th') as HTMLElement
    await expect(Math.round(header.getBoundingClientRect().height)).toBe(44)

    const cell = canvasElement.querySelector('tbody td') as HTMLElement
    await expect(Math.round(cell.getBoundingClientRect().height)).toBe(60)
    await expect(getComputedStyle(cell).paddingLeft).toBe('16px')
  },
}

export const Loading: Story = { args: { costSheets: [], total: 0, isLoading: true } }

/** A filter emptied the list: the toolbar survives, so it can be undone. */
export const FilteredEmpty: Story = {
  args: {
    costSheets: [],
    total: 0,
    query: { ...fixtureCostSheetQuery, search: 'zzz' },
    onClearFilters: fn(),
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no cost sheets match these filters/i),
    ).toBeInTheDocument()
  },
}

/**
 * Nothing created yet. The create action is offered in both the toolbar and
 * the empty state, and both call `onCreate`.
 */
export const FirstRun: Story = {
  args: {
    costSheets: [],
    total: 0,
    onCreate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No cost sheets yet')).toBeInTheDocument()
    await expect(canvas.getAllByText('Read docs')).toHaveLength(3)
    const create = canvas.getAllByRole('button', { name: /new cost sheet/i })
    await expect(create.length).toBe(1)
    await userEvent.click(create[0]!)
    await expect(args.onCreate).toHaveBeenCalledOnce()
  },
}

export const Error: Story = {
  args: {
    costSheets: [],
    total: 0,
    error: 'You do not have access to cost sheets in this environment.',
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
    costSheets: manyCostSheets(25),
    total: 120,
    query: { ...fixtureCostSheetQuery, page: 1 },
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
    expect(Object.keys(reported).sort()).toEqual(Object.keys(fixtureCostSheetQuery).sort())
  },
}

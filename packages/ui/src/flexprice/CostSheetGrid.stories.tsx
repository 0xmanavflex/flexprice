import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  type CostSheet,
  type CostSheetQuery,
  CostSheetStatus,
  DEFAULT_COST_SHEET_QUERY,
} from '@fp/domain'
import { CostSheetGrid } from './CostSheetGrid'

/**
 * The cost sheet list. The same controlled table shape as `CouponGrid`,
 * with a cost sheet's own columns: what it covers, how many prices it groups,
 * and its status. The page owns the query; this reports intent through it.
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
    // No lookup key and no prices yet — the sheet a hand-written demo omits.
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
    // Archived — the muted row.
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
  title: 'Surfaces/CostSheetGrid',
  component: CostSheetGrid,
  parameters: { layout: 'padded' },
  args: {
    costSheets: costSheetFixtures,
    total: costSheetFixtures.length,
    query: fixtureCostSheetQuery,
    onQueryChange: fn(),
    locale: 'en-US',
  },
} satisfies Meta<typeof CostSheetGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('AI inference costs')).toBeInTheDocument()
    await expect(canvas.getByText('ai_inference')).toBeInTheDocument()
    await expect(canvas.getByText('12 prices')).toBeInTheDocument()
    await expect(canvas.getAllByText('Published').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Archived')).toBeInTheDocument()
  },
}

export const Loading: Story = { args: { costSheets: [], total: 0, isLoading: true } }

export const Empty: Story = {
  args: { costSheets: [], total: 0 },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(/no cost sheets match these filters/i),
    ).toBeInTheDocument()
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

/** A full page of rows against a larger total, so the footer and pager show. */
export const ManyRows: Story = {
  args: {
    costSheets: manyCostSheets(25),
    total: 120,
    query: { ...fixtureCostSheetQuery, page: 1 },
  },
}

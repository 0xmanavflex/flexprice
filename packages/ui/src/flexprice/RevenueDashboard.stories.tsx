import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { RevenueDashboard } from './RevenueDashboard'
import type { MetricTab } from './charts'

/**
 * Revenue, on the shared chart library.
 *
 * The stories that matter here are not the pretty one. They are `Empty`,
 * `Unavailable` and `MarginIsNotDerivable` — the three states this surface was
 * rebuilt to render honestly, and the ones a dashboard carrying its own sample
 * numbers can never be in.
 */
const meta = {
  title: 'Surfaces/RevenueDashboard',
  component: RevenueDashboard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RevenueDashboard>

export default meta
type Story = StoryObj<typeof meta>

/* ---- Fixtures ------------------------------------------------------------
 *
 * Self-consistent by construction, because a story is where a surface's
 * arithmetic is read most closely: each tab's headline is the total of the
 * series under it, the mix slices sum to the mix total, and the three
 * collection states sum to the figure beside the meter.
 */

const DAY_MS = 86_400_000

/** Thirty daily buckets ending today, from a fixed shape so runs agree. */
function series(shape: number[]): { label: string; value: number }[] {
  const start = Date.UTC(2026, 8, 1)
  return shape.map((value, index) => ({
    label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
      new Date(start + index * DAY_MS),
    ),
    value,
  }))
}

const USAGE = [
  412, 468, 445, 503, 530, 388, 361, 522, 561, 548, 594, 610, 455, 402, 631, 668, 645, 692, 714,
  498, 452, 726, 759, 741, 788, 803, 566, 521, 830, 862,
]
const EVENTS = USAGE.map((value) => value * 31)
const INVOICES = [
  3, 2, 4, 3, 2, 1, 2, 4, 3, 3, 2, 4, 1, 2, 3, 4, 2, 3, 3, 2, 1, 4, 3, 2, 4, 3, 2, 1, 3, 2,
]

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })

const TABS: MetricTab[] = [
  {
    id: 'usage',
    label: 'Metered usage',
    value: compact.format(sum(USAGE)),
    changePercent: 18.4,
    points: series(USAGE),
    format: (value) => compact.format(value),
  },
  {
    id: 'events',
    label: 'Events ingested',
    value: compact.format(sum(EVENTS)),
    changePercent: 14.2,
    points: series(EVENTS),
    format: (value) => compact.format(value),
  },
  {
    id: 'invoices',
    label: 'Invoices issued',
    value: String(sum(INVOICES)),
    changePercent: -6.1,
    points: series(INVOICES),
    format: (value) => String(value),
  },
]

/** The five slices add up to the centre figure, and no two carry the same count. */
const MIX_SLICES = [
  { id: 'feat_api', label: 'API calls', value: 212_400 },
  { id: 'feat_tokens', label: 'AI tokens', value: 148_900 },
  { id: 'feat_storage', label: 'Storage writes', value: 96_250 },
  { id: 'feat_minutes', label: 'Compute minutes', value: 41_180 },
  { id: 'feat_docs', label: 'Documents parsed', value: 17_620 },
]

const MARGIN_UNAVAILABLE =
  'Gross margin needs cost and revenue aggregated together. Cost sheets record the cost side, but no endpoint returns the margin, and totals cannot be summed in the browser.'

const ready = {
  rangeLabel: 'last 30 days',
  chart: { status: 'ready' as const, tabs: TABS, activeTab: 'usage', onTabChange: fn() },
  meteredRevenue: money('9417.32', 'USD'),
  mix: {
    status: 'ready' as const,
    slices: MIX_SLICES,
    total: sum(MIX_SLICES.map((slice) => slice.value)),
  },
  margin: { status: 'unavailable' as const, percent: null, reason: MARGIN_UNAVAILABLE },
  collections: { status: 'ready' as const, paid: 52, open: 19, overdue: 6 },
  onNavigate: fn(),
}

/* ---- Stories ------------------------------------------------------------- */

export const Default: Story = {
  args: ready,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const heading of ['Revenue mix', 'Gross margin', 'Collections']) {
      await expect(canvas.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    // The centre of the donut is the sum of its own slices, not a figure typed
    // in beside them.
    await expect(canvas.getByText('516.4K')).toBeInTheDocument()
  },
}

/**
 * The one money figure on the page is the server's own subtotal, and the
 * sentence beside it says why the line above is not money.
 */
export const MeteredRevenueIsTheOnlyMoney: Story = {
  args: ready,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$9,417.32')).toBeInTheDocument()
    await expect(canvas.getByText(/plots volume, not money/)).toBeInTheDocument()
  },
}

/** Nothing priced this window. Absent, with the reason — never a zero. */
export const NoPricedSubtotal: Story = {
  args: { ...ready, meteredRevenue: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/no priced subtotal/)).toBeInTheDocument()
    await expect(canvas.queryByText(/\$/)).not.toBeInTheDocument()
  },
}

/** The chart is controlled: the surface reports the tab and holds no state. */
export const SwitchingTabs: Story = {
  args: ready,
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('tab', { name: /Invoices issued/ }))
    await expect(args.chart.onTabChange).toHaveBeenCalledWith('invoices')
  },
}

/**
 * Gross margin, as the console actually shows it.
 *
 * Not a zero and not a placeholder percentage: an em-dash and the sentence that
 * names what is missing. Deleting the panel would make "we cannot measure this"
 * and "this is not a thing" look identical.
 */
export const MarginIsNotDerivable: Story = {
  args: ready,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/no endpoint returns the margin/)).toBeInTheDocument()
    await expect(
      canvas.queryByRole('button', { name: /Gross margin on metered revenue/ }),
    ).not.toBeInTheDocument()
  },
}

/**
 * The gauge the day an aggregate lands. Unreachable from the app today — kept
 * so the panel is a wiring change rather than a rewrite, and so the tone
 * thresholds this surface owns are exercised somewhere.
 */
export const MarginWhenItArrives: Story = {
  args: {
    ...ready,
    margin: { status: 'ready' as const, percent: 43, reason: MARGIN_UNAVAILABLE },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: 'Gross margin on metered revenue: 43% (43 of 100)' }),
    ).toBeInTheDocument()
  },
}

/** A brand-new tenant: the chart keeps its shape, blurred, behind the invitation. */
export const Empty: Story = {
  args: {
    ...ready,
    chart: { status: 'empty' as const, tabs: [], activeTab: 'usage', onTabChange: fn() },
    meteredRevenue: null,
    mix: { status: 'empty' as const, slices: [], total: 0 },
    collections: { status: 'empty' as const, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // By text, not by heading role: `EmptyState`'s inline title is ReUI's
    // `EmptyTitle`, which is a styled div. Asserting a heading here would be
    // testing a role the composition does not claim to give it.
    await expect(canvas.getByText('No revenue yet')).toBeInTheDocument()
    // The blurred chart behind it is decoration, and stays out of the tree.
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Create a plan' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('/plans')
  },
}

/** The requests failed. Named, and told apart from "there is nothing yet". */
export const Unavailable: Story = {
  args: {
    ...ready,
    chart: { status: 'unavailable' as const, tabs: [], activeTab: 'usage', onTabChange: fn() },
    meteredRevenue: null,
    mix: { status: 'unavailable' as const, slices: [], total: 0 },
    collections: { status: 'unavailable' as const, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('status').length).toBeGreaterThan(2)
    await expect(canvas.getByText('Invoices could not be loaded.')).toBeInTheDocument()
  },
}

/** The margin panel routes to cost sheets, where the cost side is defined. */
export const OpensCostSheets: Story = {
  args: ready,
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Cost sheets' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('/cost-sheets')
  },
}

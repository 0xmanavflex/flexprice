import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { RevenueDashboard } from './RevenueDashboard'
import type { RevenueByCustomerRow, RevenuePanelStatus } from './RevenueDashboard'
import type { MetricTab } from '../shared/charts'

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
  argTypes: {
    rangeLabel: { control: 'text' },
    chart: { control: 'object' },
    meteredRevenue: { control: 'object' },
    mix: { control: 'object' },
    margin: { control: 'object' },
    collections: { control: 'object' },
    byCustomer: { control: 'object' },
    onNavigate: { control: false },
  },
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
  'Gross margin is not wired up yet. The cost analytics endpoint does return revenue, cost and margin together, but no hook in this console calls it, so there is no figure to show rather than no figure to be had.'

/**
 * The per-customer table's gap list.
 *
 * Kept verbatim from what `RevenuePage` passes, because the point of the
 * story is that the screen names real endpoints — a story with placeholder
 * blockers would not catch the sentence going stale.
 */
const BY_CUSTOMER_UNAVAILABLE =
  'No endpoint returns revenue grouped by customer. The figures below could only be assembled one request per customer, or by summing invoices in the browser — which this console does not do, because a total it recomputes will eventually disagree with the invoice the customer was actually charged.'

const BY_CUSTOMER_GAPS = [
  {
    column: 'Plan',
    blocker:
      'A customer record carries no plan; a plan belongs to their contracts. Needs a joined list view, or one contracts request per customer.',
  },
  {
    column: 'Net revenue',
    blocker:
      'Available per customer only as a lifetime total, from GET /customers/{id}/invoices/summary — one call each, not windowed to the range above, and split per currency.',
  },
  {
    column: 'Contract',
    blocker:
      'No endpoint splits recognised revenue into fixed and usage components. The invoice summary splits only what is still unpaid.',
  },
  {
    column: 'Usage',
    blocker:
      'POST /events/analytics prices a window as a whole and cannot group by customer, so usage revenue per customer has no source.',
  },
  {
    column: 'Cost',
    blocker:
      'POST /costs/analytics returns cost per customer, but one external_customer_id per request, and its per-meter items would have to be summed to get a row total.',
  },
  {
    column: 'Margin %',
    blocker:
      'Returned by POST /costs/analytics for the tenant or for a single customer. Needs the same per-customer fan-out as Cost, plus a hook — there is none today.',
  },
]

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
  byCustomer: {
    status: 'unavailable' as const,
    reason: BY_CUSTOMER_UNAVAILABLE,
    columns: BY_CUSTOMER_GAPS,
  },
  onNavigate: fn(),
}

/* ---- Stories ------------------------------------------------------------- */

const STATUSES: RevenuePanelStatus[] = ['ready', 'loading', 'empty', 'unavailable']
const CUSTOMER_NAMES = [
  'Acme Inc',
  'Globex',
  'Initech',
  'Umbrella',
  'Hooli',
  'Stark Industries',
  'Wayne Enterprises',
  'Wonka',
]

interface PlaygroundArgs {
  periodDays: number
  chartStatus: RevenuePanelStatus
  tabCount: number
  activeTab: string
  hasMeteredRevenue: boolean
  revenue: string
  currency: string
  mixStatus: RevenuePanelStatus
  sliceCount: number
  marginStatus: RevenuePanelStatus
  marginPercent: number
  collectionsStatus: RevenuePanelStatus
  paid: number
  open: number
  overdue: number
  byCustomerStatus: RevenuePanelStatus
  customerRows: number
  onTabChange: (id: string) => void
  onNavigate: (path: string) => void
}

/** Tabs sliced to the chosen period; the headline of each is the total of the points under it. */
function makeTabs(periodDays: number, tabCount: number): MetricTab[] {
  return TABS.slice(0, tabCount).map((tab, index) => {
    const source = [USAGE, EVENTS, INVOICES][index] ?? USAGE
    const values = source.slice(0, periodDays)
    const total = sum(values)
    return {
      ...tab,
      value: index === 2 ? String(total) : compact.format(total),
      points: series(values),
    }
  })
}

function makeCustomerRows(count: number): RevenueByCustomerRow[] {
  return Array.from({ length: count }, (_, index) => {
    const net = 48_200 - index * 4_300
    const cost = 14_100 - index * 900
    const pct = Math.round(((net - cost) / net) * 1000) / 10
    const usd = (value: number) => `$${value.toLocaleString('en-US')}.00`
    return {
      id: `c${index + 1}`,
      customer: CUSTOMER_NAMES[index] ?? `Customer ${index + 1}`,
      plan: ['Scale', 'Growth', 'Starter'][index % 3] ?? 'Scale',
      netRevenue: usd(net),
      contract: usd(12_000),
      usage: usd(net - 12_000),
      cost: usd(cost),
      margin: `${pct}%`,
    }
  })
}

/** Holds the active tab so the chart's tabs actually switch. */
function PlaygroundRevenue(args: PlaygroundArgs) {
  const [activeTab, setActiveTab] = useState(args.activeTab)
  useEffect(() => setActiveTab(args.activeTab), [args.activeTab])

  const tabs = makeTabs(args.periodDays, args.tabCount)
  const current = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? activeTab)
  const mixReady = args.mixStatus === 'ready'
  const slices = mixReady ? MIX_SLICES.slice(0, args.sliceCount) : []
  const collectionsReady = args.collectionsStatus === 'ready'
  const amount = /^-?\d+(\.\d+)?$/.test(args.revenue) ? args.revenue : '0'
  const rows = args.byCustomerStatus === 'ready' ? makeCustomerRows(args.customerRows) : []

  return (
    <RevenueDashboard
      rangeLabel={`last ${args.periodDays} days`}
      chart={{
        status: args.chartStatus,
        tabs: args.chartStatus === 'ready' ? tabs : [],
        activeTab: current,
        onTabChange: (id) => {
          setActiveTab(id)
          args.onTabChange(id)
        },
      }}
      meteredRevenue={args.hasMeteredRevenue ? money(amount, args.currency) : null}
      mix={{ status: args.mixStatus, slices, total: sum(slices.map((slice) => slice.value)) }}
      margin={{
        status: args.marginStatus,
        percent: args.marginStatus === 'ready' ? args.marginPercent : null,
        reason: MARGIN_UNAVAILABLE,
      }}
      collections={{
        status: args.collectionsStatus,
        paid: collectionsReady ? args.paid : 0,
        open: collectionsReady ? args.open : 0,
        overdue: collectionsReady ? args.overdue : 0,
      }}
      byCustomer={{
        status: args.byCustomerStatus,
        reason: BY_CUSTOMER_UNAVAILABLE,
        columns: BY_CUSTOMER_GAPS,
        ...(rows.length > 0 ? { rows } : {}),
      }}
      onNavigate={args.onNavigate}
    />
  )
}

/** Flip each panel between ready, loading, empty and unavailable; change the period, tabs, slices and rows. */
export const Playground = {
  args: {
    periodDays: 30,
    chartStatus: 'ready',
    tabCount: 3,
    activeTab: 'usage',
    hasMeteredRevenue: true,
    revenue: '9417.32',
    currency: 'USD',
    mixStatus: 'ready',
    sliceCount: 5,
    marginStatus: 'unavailable',
    marginPercent: 43,
    collectionsStatus: 'ready',
    paid: 52,
    open: 19,
    overdue: 6,
    byCustomerStatus: 'unavailable',
    customerRows: 5,
    onTabChange: fn(),
    onNavigate: fn(),
  },
  argTypes: {
    periodDays: { control: 'select', options: [7, 14, 30] },
    chartStatus: { control: 'select', options: STATUSES },
    tabCount: { control: { type: 'range', min: 1, max: TABS.length, step: 1 } },
    activeTab: { control: 'select', options: TABS.map((tab) => tab.id) },
    hasMeteredRevenue: {
      control: 'boolean',
      description: 'Off means the server sent no subtotal.',
    },
    revenue: { control: 'text', description: 'Plain decimal string; invalid reads as 0.' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    mixStatus: { control: 'select', options: STATUSES },
    sliceCount: { control: { type: 'range', min: 0, max: MIX_SLICES.length, step: 1 } },
    marginStatus: { control: 'select', options: STATUSES },
    marginPercent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    collectionsStatus: { control: 'select', options: STATUSES },
    paid: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    open: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    overdue: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    byCustomerStatus: { control: 'select', options: STATUSES },
    customerRows: { control: { type: 'range', min: 0, max: CUSTOMER_NAMES.length, step: 1 } },
    onTabChange: { control: false },
    onNavigate: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'periodDays',
        'chartStatus',
        'tabCount',
        'activeTab',
        'hasMeteredRevenue',
        'revenue',
        'currency',
        'mixStatus',
        'sliceCount',
        'marginStatus',
        'marginPercent',
        'collectionsStatus',
        'paid',
        'open',
        'overdue',
        'byCustomerStatus',
        'customerRows',
        'onTabChange',
        'onNavigate',
      ],
    },
  },
  render: (args) => <PlaygroundRevenue {...args} />,
} satisfies StoryObj<PlaygroundArgs>

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
    // The sentence has to say *we have not wired it*, not *the API cannot*.
    // POST /costs/analytics returns margin outright, so the older wording
    // sent the reader to the wrong team.
    await expect(canvas.getByText(/Gross margin is not wired up yet/)).toBeInTheDocument()
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

/**
 * The per-customer table names its gaps instead of inventing numbers.
 *
 * This is the story worth keeping. The surface this replaced listed five
 * customers and what each had spent, and none of those figures came from
 * anywhere — so the assertion is not that the panel renders, it is that the
 * panel renders *no money at all* while still telling the reader which
 * endpoint each missing column is waiting on.
 */
export const RevenueByCustomerIsNotDerivable: Story = {
  args: ready,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText('Revenue by customer')).toBeInTheDocument()

    // Every column of the asked-for table is accounted for by name.
    for (const gap of BY_CUSTOMER_GAPS) {
      // Once as the table's header, once as the gap it waits on.
      await expect(canvas.getAllByText(gap.column).length).toBeGreaterThan(0)
    }

    // The blockers name real routes, so the screen doubles as the backend spec.
    await expect(canvas.getByText(/GET \/customers\/\{id\}\/invoices\/summary/)).toBeInTheDocument()
    await expect(canvas.getAllByText(/POST \/costs\/analytics/).length).toBeGreaterThan(0)

    // And not one currency figure anywhere in the panel.
    const panel = canvas.getByText('Revenue by customer').closest('section')
    await expect(panel).not.toBeNull()
    await expect((panel as HTMLElement).textContent ?? '').not.toMatch(/[$£€]\s?\d/)
  },
}

/** When an endpoint supplies rows, the table draws them and the gap list goes. */
export const RevenueByCustomerRows: Story = {
  args: {
    ...ready,
    byCustomer: {
      ...ready.byCustomer,
      status: 'ready' as const,
      rows: [
        {
          id: 'c1',
          customer: 'Acme Inc',
          plan: 'Scale',
          netRevenue: '$48,200.00',
          contract: '$12,000.00',
          usage: '$36,200.00',
          cost: '$14,100.00',
          margin: '70.7%',
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Acme Inc')).toBeInTheDocument()
    await expect(canvas.queryByText(/POST \/costs\/analytics/)).not.toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DashboardHome } from './DashboardHome'
import type {
  DashboardHomeProps,
  EventsPanel,
  InvoicesPanel,
  PanelStatus,
  SubscriptionsPanel,
} from './DashboardHome'

/**
 * Home: the console overview.
 *
 * The three states below are the reason this component takes data rather than
 * fetching it. `Populated` and `FirstRun` are the two the design specified, and
 * `Unavailable` is the one the product actually needs most: what a panel looks
 * like when Flexprice has no answer.
 *
 * Usage by feature and the API panel are parked until quota-based metrics land,
 * so they have no fixtures here.
 *
 * The figures in `Populated` are story fixtures and are internally consistent:
 * the plan counts sum to the total, the invoice buckets sum to the centre
 * number: because a story that contradicts itself teaches the wrong shape.
 */

const RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
]
const GRANULARITY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'hourly', label: 'Hourly' },
]

const DAYS = ['23 Sep', '24 Sep', '25 Sep', '26 Sep', '27 Sep', '28 Sep', '29 Sep']

const events: EventsPanel = {
  status: 'ready',
  points: [712_400, 688_100, 745_900, 634_800, 771_200, 814_200, 772_800].map((value, index) => ({
    label: DAYS[index]!,
    events: value,
  })),
  total: 5_139_400,
  revenue: money('184210.00', 'USD'),
  totalChangePercent: 8.4,
  revenueChangePercent: -2.1,
}

// 11 + 10 + 9 + 8 = 38, the number above the bars.
const subscriptions: SubscriptionsPanel = {
  status: 'ready',
  total: 38,
  changePercent: 12,
  days: DAYS.map((label, index) => ({
    label,
    byPlan: {
      Studio: [2, 1, 2, 1, 2, 2, 1][index]!,
      Growth: [1, 2, 1, 2, 1, 2, 1][index]!,
      Starter: [1, 1, 2, 1, 1, 2, 1][index]!,
      Platform: [1, 1, 1, 1, 2, 1, 1][index]!,
    },
  })),
  plans: [
    { name: 'Studio', count: 11 },
    { name: 'Growth', count: 10 },
    { name: 'Starter', count: 9 },
    { name: 'Platform', count: 8 },
  ],
}

// 34 + 15 + 7 = 56.
const invoices: InvoicesPanel = { status: 'ready', total: 56, paid: 34, open: 15, overdue: 7 }

const meta = {
  title: 'App/Home/Home dashboard',
  component: DashboardHome,
  parameters: { layout: 'fullscreen' },
  args: {
    rangeOptions: RANGE_OPTIONS,
    range: '7d',
    onRangeChange: fn(),
    granularityOptions: GRANULARITY_OPTIONS,
    granularity: 'daily',
    onGranularityChange: fn(),
    rangeLabel: 'last 7 days',
    events,
    subscriptions,
    invoices,
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'select', options: RANGE_OPTIONS.map((option) => option.id) },
    granularity: { control: 'select', options: GRANULARITY_OPTIONS.map((option) => option.id) },
    rangeLabel: { control: 'text' },
    rangeOptions: { control: false },
    granularityOptions: { control: false },
    events: { control: 'object' },
    subscriptions: { control: 'object' },
    invoices: { control: 'object' },
    onRangeChange: { control: false },
    onGranularityChange: { control: false },
    onNavigate: { control: false },
  },
  // The overview owns its scroll: the shell's content region does not scroll
  // for it: so the story gives it a bounded, scrollable frame to render into.
  decorators: [
    (Story) => (
      <div className="bg-background h-screen overflow-y-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DashboardHome>

export default meta
type Story = StoryObj<typeof meta>

const PANEL_STATUSES: PanelStatus[] = ['ready', 'loading', 'empty', 'unavailable']
const PLAN_POOL = ['Studio', 'Growth', 'Starter', 'Platform']

interface PlaygroundArgs {
  range: string
  granularity: string
  eventsStatus: PanelStatus
  subscriptionsStatus: PanelStatus
  invoicesStatus: PanelStatus
  dayCount: number
  eventsPerDay: number
  revenue: string
  currency: string
  showChange: boolean
  plansShown: number
  contractsPerDay: number
  paid: number
  open: number
  overdue: number
  onRangeChange: (range: string) => void
  onGranularityChange: (granularity: string) => void
  onNavigate: (path: string) => void
}

/** Builds all four panels from the playground args; non-ready panels carry no data, as in the real page. */
function makePanels(
  args: PlaygroundArgs,
): Pick<DashboardHomeProps, 'events' | 'subscriptions' | 'invoices'> {
  const labels = Array.from({ length: args.dayCount }, (_, index) => `Day ${index + 1}`)
  const plans = PLAN_POOL.slice(0, args.plansShown)
  const eventsReady = args.eventsStatus === 'ready'
  const points = eventsReady
    ? labels.map((label, index) => ({
        label,
        events: Math.round(args.eventsPerDay * (0.8 + ((index * 7) % 5) * 0.1)),
      }))
    : []
  const revenueAmount = /^-?\d+(\.\d+)?$/.test(args.revenue) ? args.revenue : '0'

  const days =
    args.subscriptionsStatus === 'ready' && plans.length > 0
      ? labels.map((label, index) => ({
          label,
          byPlan: Object.fromEntries(
            plans.map((plan, planIndex) => [
              plan,
              (index + planIndex) % (args.contractsPerDay + 1),
            ]),
          ),
        }))
      : []
  const planCounts = plans.map((name) => ({
    name,
    count: days.reduce((sum, day) => sum + (day.byPlan[name] ?? 0), 0),
  }))
  const subscriptionTotal = planCounts.reduce((sum, plan) => sum + plan.count, 0)

  const invoiceReady = args.invoicesStatus === 'ready'

  return {
    events: {
      status: args.eventsStatus,
      points,
      total: eventsReady ? points.reduce((sum, point) => sum + point.events, 0) : null,
      revenue: eventsReady ? money(revenueAmount, args.currency) : null,
      totalChangePercent: eventsReady && args.showChange ? 8.4 : null,
      revenueChangePercent: eventsReady && args.showChange ? -2.1 : null,
    },
    subscriptions: {
      status: args.subscriptionsStatus,
      total: subscriptionTotal,
      changePercent: subscriptionTotal > 0 ? 12 : null,
      days,
      plans: planCounts,
    },
    invoices: {
      status: args.invoicesStatus,
      total: invoiceReady ? args.paid + args.open + args.overdue : 0,
      paid: invoiceReady ? args.paid : 0,
      open: invoiceReady ? args.open : 0,
      overdue: invoiceReady ? args.overdue : 0,
    },
  }
}

/** Keeps the two filters live so the selects in the page actually change. */
function PlaygroundHome(args: PlaygroundArgs) {
  const [range, setRange] = useState(args.range)
  const [granularity, setGranularity] = useState(args.granularity)
  useEffect(() => setRange(args.range), [args.range])
  useEffect(() => setGranularity(args.granularity), [args.granularity])

  const rangeLabel = (
    RANGE_OPTIONS.find((option) => option.id === range)?.label ?? range
  ).toLowerCase()

  return (
    <DashboardHome
      rangeOptions={RANGE_OPTIONS}
      range={range}
      onRangeChange={(next) => {
        setRange(next)
        args.onRangeChange(next)
      }}
      granularityOptions={GRANULARITY_OPTIONS}
      granularity={granularity}
      onGranularityChange={(next) => {
        setGranularity(next)
        args.onGranularityChange(next)
      }}
      rangeLabel={rangeLabel}
      {...makePanels(args)}
      onNavigate={args.onNavigate}
    />
  )
}

/** Flip each panel between ready, loading, empty and unavailable, and size the data behind them. */
export const Playground = {
  args: {
    range: '7d',
    granularity: 'daily',
    eventsStatus: 'ready',
    subscriptionsStatus: 'ready',
    invoicesStatus: 'ready',
    dayCount: 7,
    eventsPerDay: 750_000,
    revenue: '184210.00',
    currency: 'USD',
    showChange: true,
    plansShown: 4,
    contractsPerDay: 2,
    paid: 34,
    open: 15,
    overdue: 7,
    onRangeChange: fn(),
    onGranularityChange: fn(),
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'inline-radio', options: RANGE_OPTIONS.map((option) => option.id) },
    granularity: {
      control: 'inline-radio',
      options: GRANULARITY_OPTIONS.map((option) => option.id),
    },
    eventsStatus: { control: 'select', options: PANEL_STATUSES },
    subscriptionsStatus: { control: 'select', options: PANEL_STATUSES },
    invoicesStatus: { control: 'select', options: PANEL_STATUSES },
    dayCount: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    eventsPerDay: { control: { type: 'number', min: 0, max: 5_000_000, step: 50_000 } },
    revenue: { control: 'text', description: 'Plain decimal string; invalid reads as 0.' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    showChange: {
      control: 'boolean',
      description: 'Shows each tab’s change against the prior window.',
    },
    plansShown: { control: { type: 'range', min: 0, max: PLAN_POOL.length, step: 1 } },
    contractsPerDay: { control: { type: 'range', min: 1, max: 6, step: 1 } },
    paid: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    open: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    overdue: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    onRangeChange: { control: false },
    onGranularityChange: { control: false },
    onNavigate: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'range',
        'granularity',
        'eventsStatus',
        'subscriptionsStatus',
        'invoicesStatus',
        'dayCount',
        'eventsPerDay',
        'revenue',
        'currency',
        'showChange',
        'plansShown',
        'contractsPerDay',
        'paid',
        'open',
        'overdue',
        'onRangeChange',
        'onGranularityChange',
        'onNavigate',
      ],
    },
  },
  render: (args) => <PlaygroundHome {...args} />,
} satisfies StoryObj<PlaygroundArgs>

/** Every panel has data. The design, as specified. */
export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    for (const heading of ['Key metrics', 'Recent contracts', 'Invoice payment status']) {
      await expect(canvas.getByRole('heading', { name: heading })).toBeInTheDocument()
    }

    // Parked until quota-based metrics land.
    await expect(canvas.queryByRole('heading', { name: 'Usage by feature' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'API' })).toBeNull()

    // The stat strip is the tab strip, in reading order, and Revenue is the
    // tab you land on.
    const tabs = canvas.getAllByRole('tab')
    await expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining('Revenue'),
      expect.stringContaining('Usage ingestion'),
    ])
    await expect(canvas.getByRole('tab', { name: /Revenue/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // No explanatory captions around the chart: they appeared and vanished and moved the page.
    await expect(canvas.queryByText(/priced for the window/i)).toBeNull()

    // Each tab reads the totals it was given, compactly.
    await expect(canvas.getByText('5.1M')).toBeInTheDocument()

    // The invoice gauge's centre total equals the sum of its three buckets.
    await expect(canvas.getByText('56')).toBeInTheDocument()

    // No "Configure" shortcut: the filters are the only controls up top.
    await expect(canvas.queryByRole('button', { name: 'Configure' })).toBeNull()
    await expect(canvas.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect(canvas.queryByRole('combobox', { name: 'Customer' })).toBeNull()
    await expect(canvas.queryByText(/customer filter applies/i)).toBeNull()
  },
}

/** Switching metric switches the plot. */
export const SwitchesMetric: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Usage ingestion/ }))
    await expect(canvas.getByRole('tab', { name: /Usage ingestion/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  },
}

/** Changing the range is a real interaction: the page is told, and re-fetches. */
export const ChangesRange: Story = {
  parameters: {
    // Base UI's open select renders aria-hidden focus guards; the repo disables
    // this rule on every story that opens a popup.
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Range' }))
    await userEvent.click(
      await within(document.body).findByRole('option', { name: 'Last 30 days' }),
    )
    await expect(args.onRangeChange).toHaveBeenCalledWith('30d')
  },
}

/** "View invoices" goes to the list the gauge is summarising. */
export const LinksToInvoices: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'View invoices' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('/invoices')
  },
}

/**
 * Nothing ingested yet, over the widest range on offer, so "no usage" can be
 * read as "never": the first-run invitation, dashes in the stat strip and a
 * dimmed chart.
 */
export const FirstRun: Story = {
  args: {
    range: '30d',
    rangeLabel: 'last 30 days',
    events: { status: 'empty', points: [], total: null, revenue: null },
    subscriptions: { status: 'empty', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'empty', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No events received yet')).toBeInTheDocument()
    await expect(canvas.queryByText('No usage in this period')).toBeNull()
    await expect(canvas.getByText('No contracts were created in this period.')).toBeInTheDocument()
    await expect(canvas.getByText('No invoices in this period.')).toBeInTheDocument()

    // Nothing is claimed: no "0 new contracts", no "0" in the invoice ring, and
    // the test event is offered rather than a number being guessed.
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Send a test event' })).toBeInTheDocument()

    // The message sits *over* a chart rather than instead of one, and that
    // chart is decoration three ways over: out of the accessibility tree, out
    // of the tab order, and carrying no readable figure.
    const blurred = canvasElement.querySelector('[aria-hidden="true"][inert]')
    await expect(blurred).not.toBeNull()
    await expect(blurred?.querySelectorAll('[role="tab"]').length ?? 0).toBeGreaterThan(0)
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
  },
}

/** The window is empty but a wider one might not be: this is a period message, not a first-run one, and it offers the wider range rather than a quickstart. */
export const PeriodEmpty: Story = {
  args: {
    events: { status: 'empty', points: [], total: null, revenue: null },
    subscriptions: { status: 'empty', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'empty', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No usage in this period')).toBeInTheDocument()
    await expect(canvas.queryByText('No events received yet')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Send a test event' })).toBeNull()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Show last 30 days' })[0]!)
    await expect(args.onRangeChange).toHaveBeenCalledWith('30d')
  },
}

/**
 * Every query is in flight. Bars where the numbers go, a skeleton where the
 * chart goes, no first-run invitation and no zeroes.
 */
export const Loading: Story = {
  args: {
    events: { status: 'loading', points: [], total: null, revenue: null },
    subscriptions: { status: 'loading', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'loading', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Loading Revenue' })).toBeInTheDocument()
    await expect(canvas.getByRole('img', { name: 'Loading new contracts' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('status').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.queryByText('—')).toBeNull()
    await expect(canvas.queryByText('No events received yet')).toBeNull()
    await expect(canvas.queryByText('No usage in this period')).toBeNull()
    await expect(canvasElement.querySelector('[inert]')).toBeNull()
  },
}

/**
 * Part of the page failed. The events tabs say so with a retry while the
 * invoice ring, which loaded, stays on screen.
 */
export const PartialFailure: Story = {
  args: {
    events: { status: 'unavailable', points: [], total: null, revenue: null, onRetry: fn() },
    invoices: { ...invoices, basedOn: 'Based on the latest 100 invoices.' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Revenue couldn’t be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('56')).toBeInTheDocument()
    // A sampling note is not drawn under the panel.
    await expect(canvas.queryByText('Based on the latest 100 invoices.')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.events.onRetry).toHaveBeenCalled()
  },
}

/** A refresh failed over good data: the figures stay, with their age and a retry. */
export const StaleKeepsData: Story = {
  args: {
    events: { ...events, stale: true, updatedAt: Date.now() - 5 * 60_000, onRetry: fn() },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Couldn’t refresh/)).toBeInTheDocument()
    await expect(canvas.getByText('5.1M')).toBeInTheDocument()
    await expect(canvas.queryByText('Revenue couldn’t be loaded.')).toBeNull()
  },
}

/** Every query failed. The panels say so, with a way to ask again, rather than rendering zeroes. */
export const Unavailable: Story = {
  args: {
    events: { status: 'unavailable', points: [], total: null, revenue: null, onRetry: fn() },
    subscriptions: {
      status: 'unavailable',
      total: 0,
      changePercent: null,
      days: [],
      plans: [],
      onRetry: fn(),
    },
    invoices: {
      status: 'unavailable',
      total: 0,
      paid: 0,
      open: 0,
      overdue: 0,
      onRetry: fn(),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Revenue couldn’t be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('Contracts could not be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('Invoices could not be loaded.')).toBeInTheDocument()
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.queryByText('No events received yet')).toBeNull()
    await userEvent.click(canvas.getAllByRole('button', { name: /try again/i })[0]!)
    await expect(args.events.onRetry).toHaveBeenCalled()
  },
}

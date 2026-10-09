import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DashboardHome } from './DashboardHome'
import type {
  CustomersPanel,
  DashboardHomeProps,
  EventsPanel,
  InvoicesPanel,
  PanelStatus,
  SubscriptionsPanel,
} from './DashboardHome'

/**
 * Home — the console overview.
 *
 * The three states below are the reason this component takes data rather than
 * fetching it. `Populated` and `FirstRun` are the two the design specified, and
 * `Unavailable` is the one the product actually needs most: what a panel looks
 * like when Flexprice has no answer, which on this surface is a real and
 * permanent condition for processing lag.
 *
 * Usage by feature and the API panel are parked until quota-based metrics land,
 * so they have no fixtures here.
 *
 * The figures in `Populated` are story fixtures and are internally consistent —
 * the plan counts sum to the total, the invoice buckets sum to the centre
 * number — because a story that contradicts itself teaches the wrong shape.
 */

const RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
]
const GRANULARITY_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'hourly', label: 'Hourly' },
]
const CUSTOMER_OPTIONS = [
  { id: 'all', label: 'All customers' },
  { id: 'cus_1', label: 'Globex 1' },
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

// 1 + 0 + 2 + 3 + 1 + 4 + 2 + 1 = 14, the Customers headline.
const customers: CustomersPanel = {
  status: 'ready',
  newCount: 14,
  partial: false,
  points: ['22 Sep', ...DAYS].map((label, index) => ({
    label,
    customers: [1, 0, 2, 3, 1, 4, 2, 1][index]!,
  })),
  changePercent: 27.3,
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
  title: 'Surfaces/DashboardHome',
  component: DashboardHome,
  parameters: { layout: 'fullscreen' },
  args: {
    rangeOptions: RANGE_OPTIONS,
    range: '7d',
    onRangeChange: fn(),
    granularityOptions: GRANULARITY_OPTIONS,
    granularity: 'daily',
    onGranularityChange: fn(),
    customerOptions: CUSTOMER_OPTIONS,
    customer: 'all',
    onCustomerChange: fn(),
    rangeLabel: 'last 7 days',
    events,
    customers,
    subscriptions,
    invoices,
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'select', options: RANGE_OPTIONS.map((option) => option.id) },
    granularity: { control: 'select', options: GRANULARITY_OPTIONS.map((option) => option.id) },
    customer: { control: 'select', options: CUSTOMER_OPTIONS.map((option) => option.id) },
    rangeLabel: { control: 'text' },
    rangeOptions: { control: false },
    granularityOptions: { control: false },
    customerOptions: { control: false },
    events: { control: 'object' },
    customers: { control: 'object' },
    subscriptions: { control: 'object' },
    invoices: { control: 'object' },
    onRangeChange: { control: false },
    onGranularityChange: { control: false },
    onCustomerChange: { control: false },
    onNavigate: { control: false },
  },
  // The overview owns its scroll — the shell's content region does not scroll
  // for it — so the story gives it a bounded, scrollable frame to render into.
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
  customer: string
  eventsStatus: PanelStatus
  customersStatus: PanelStatus
  subscriptionsStatus: PanelStatus
  invoicesStatus: PanelStatus
  dayCount: number
  eventsPerDay: number
  revenue: string
  currency: string
  newCustomersPerDay: number
  partialCustomers: boolean
  showChange: boolean
  plansShown: number
  contractsPerDay: number
  paid: number
  open: number
  overdue: number
  onRangeChange: (range: string) => void
  onGranularityChange: (granularity: string) => void
  onCustomerChange: (customer: string) => void
  onNavigate: (path: string) => void
}

/** Builds all four panels from the playground args; non-ready panels carry no data, as in the real page. */
function makePanels(
  args: PlaygroundArgs,
): Pick<DashboardHomeProps, 'events' | 'customers' | 'subscriptions' | 'invoices'> {
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
  const customersReady = args.customersStatus === 'ready'
  const customerPoints = customersReady
    ? labels.map((label, index) => ({
        label,
        customers: Math.round(args.newCustomersPerDay * (0.5 + ((index * 3) % 4) * 0.25)),
      }))
    : []

  return {
    events: {
      status: args.eventsStatus,
      points,
      total: eventsReady ? points.reduce((sum, point) => sum + point.events, 0) : null,
      revenue: eventsReady ? money(revenueAmount, args.currency) : null,
      totalChangePercent: eventsReady && args.showChange ? 8.4 : null,
      revenueChangePercent: eventsReady && args.showChange ? -2.1 : null,
    },
    customers: {
      status: args.customersStatus,
      newCount: customersReady
        ? customerPoints.reduce((sum, point) => sum + point.customers, 0)
        : null,
      partial: customersReady && args.partialCustomers,
      points: customerPoints,
      changePercent: customersReady && args.showChange && !args.partialCustomers ? 27.3 : null,
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

/** Keeps the three filters live so the selects in the page actually change. */
function PlaygroundHome(args: PlaygroundArgs) {
  const [range, setRange] = useState(args.range)
  const [granularity, setGranularity] = useState(args.granularity)
  const [customer, setCustomer] = useState(args.customer)
  useEffect(() => setRange(args.range), [args.range])
  useEffect(() => setGranularity(args.granularity), [args.granularity])
  useEffect(() => setCustomer(args.customer), [args.customer])

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
      customerOptions={CUSTOMER_OPTIONS}
      customer={customer}
      onCustomerChange={(next) => {
        setCustomer(next)
        args.onCustomerChange(next)
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
    customer: 'all',
    eventsStatus: 'ready',
    customersStatus: 'ready',
    subscriptionsStatus: 'ready',
    invoicesStatus: 'ready',
    dayCount: 7,
    eventsPerDay: 750_000,
    revenue: '184210.00',
    currency: 'USD',
    newCustomersPerDay: 2,
    partialCustomers: false,
    showChange: true,
    plansShown: 4,
    contractsPerDay: 2,
    paid: 34,
    open: 15,
    overdue: 7,
    onRangeChange: fn(),
    onGranularityChange: fn(),
    onCustomerChange: fn(),
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'inline-radio', options: RANGE_OPTIONS.map((option) => option.id) },
    granularity: {
      control: 'inline-radio',
      options: GRANULARITY_OPTIONS.map((option) => option.id),
    },
    customer: { control: 'inline-radio', options: CUSTOMER_OPTIONS.map((option) => option.id) },
    eventsStatus: { control: 'select', options: PANEL_STATUSES },
    customersStatus: { control: 'select', options: PANEL_STATUSES },
    subscriptionsStatus: { control: 'select', options: PANEL_STATUSES },
    invoicesStatus: { control: 'select', options: PANEL_STATUSES },
    dayCount: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    eventsPerDay: { control: { type: 'number', min: 0, max: 5_000_000, step: 50_000 } },
    revenue: { control: 'text', description: 'Plain decimal string; invalid reads as 0.' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    newCustomersPerDay: { control: { type: 'range', min: 0, max: 20, step: 1 } },
    partialCustomers: { control: 'boolean', description: 'Shows the count as a floor, with a +.' },
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
    onCustomerChange: { control: false },
    onNavigate: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'range',
        'granularity',
        'customer',
        'eventsStatus',
        'customersStatus',
        'subscriptionsStatus',
        'invoicesStatus',
        'dayCount',
        'eventsPerDay',
        'revenue',
        'currency',
        'newCustomersPerDay',
        'partialCustomers',
        'showChange',
        'plansShown',
        'contractsPerDay',
        'paid',
        'open',
        'overdue',
        'onRangeChange',
        'onGranularityChange',
        'onCustomerChange',
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
      expect.stringContaining('Customers'),
      expect.stringContaining('Usage ingestion'),
      expect.stringContaining('Processing lag'),
    ])
    await expect(canvas.getByRole('tab', { name: /Revenue/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(
      canvas.getByText(
        'Revenue is priced for the window as a whole; the usage API returns no per-bucket figure to plot.',
      ),
    ).toBeInTheDocument()

    // Each tab reads the totals it was given, compactly.
    await expect(canvas.getByText('5.1M')).toBeInTheDocument()
    await expect(canvas.getByText('14')).toBeInTheDocument()

    // The invoice gauge's centre total equals the sum of its three buckets.
    await expect(canvas.getByText('56')).toBeInTheDocument()

    // No "Configure" shortcut: the filters are the only controls up top.
    await expect(canvas.queryByRole('button', { name: 'Configure' })).toBeNull()
  },
}

/** Switching metric switches the plot. */
export const SwitchesMetric: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Usage ingestion/ }))
    await expect(canvas.getByText('Usage events received, last 7 days.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: /Customers/ }))
    await expect(canvas.getByText('New customers, last 7 days.')).toBeInTheDocument()
  },
}

/**
 * The number that has no endpoint stays absent even when everything else is
 * populated — this is the regression guard for the defect that prompted the
 * rebuild, where a plausible figure stood in for one nobody could source.
 */
export const UnavailableMetricsStayAbsent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // The reason is shown on the tab that has no series, not before it is chosen.
    await userEvent.click(canvas.getByRole('tab', { name: /Processing lag/ }))
    await expect(
      canvas.getByText('Flexprice does not expose an ingestion-lag metric.'),
    ).toBeInTheDocument()

    // Processing lag: one dash, no invented number.
    await expect(canvas.getAllByText('—')).toHaveLength(1)
  },
}

/** A first page that is entirely inside the window is a floor, and says so. */
export const PartialCustomerCount: Story = {
  args: { customers: { ...customers, newCount: 100, partial: true } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('100+')).toBeInTheDocument()
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
 * Nothing ingested yet.
 *
 * The full first-run variant: dashes in the stat strip, the invitation over a
 * dimmed chart, and greyed bars.
 */
export const FirstRun: Story = {
  args: {
    events: { status: 'empty', points: [], total: null, revenue: null },
    customers: { status: 'empty', newCount: 0, partial: false, points: [] },
    subscriptions: { status: 'empty', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'empty', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No events yet')).toBeInTheDocument()
    await expect(
      canvas.getByText('Contracts created in this period appear here, by plan.'),
    ).toBeInTheDocument()

    // Nothing is claimed: every headline figure is a dash or a zero, and the
    // quickstart is offered rather than a number being guessed.
    await expect(canvas.getByRole('button', { name: 'Quickstart' })).toBeInTheDocument()

    // The message sits *over* a chart rather than instead of one, and that
    // chart is decoration three ways over — out of the accessibility tree, out
    // of the tab order, and carrying no readable figure.
    const blurred = canvasElement.querySelector('[aria-hidden="true"][inert]')
    await expect(blurred).not.toBeNull()
    await expect(blurred?.querySelectorAll('[role="tab"]').length ?? 0).toBeGreaterThan(0)
    await expect(canvas.queryByRole('tab')).not.toBeInTheDocument()
  },
}

/** Every query failed. The panels say so rather than rendering zeroes. */
export const Unavailable: Story = {
  args: {
    events: { status: 'unavailable', points: [], total: null, revenue: null },
    customers: { status: 'unavailable', newCount: null, partial: false, points: [] },
    subscriptions: { status: 'unavailable', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'unavailable', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Usage analytics unavailable')).toBeInTheDocument()
    await expect(canvas.getByText('Contracts could not be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('Invoices could not be loaded.')).toBeInTheDocument()
  },
}

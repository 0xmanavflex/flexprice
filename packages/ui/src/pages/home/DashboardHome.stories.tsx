import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DashboardHome } from './DashboardHome'
import type {
  DashboardHomeProps,
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
 * like when Flexprice has no answer.
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

const DAYS = ['23 Sep', '24 Sep', '25 Sep', '26 Sep', '27 Sep', '28 Sep', '29 Sep']

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
    rangeLabel: 'last 7 days',
    subscriptions,
    invoices,
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'select', options: RANGE_OPTIONS.map((option) => option.id) },
    rangeLabel: { control: 'text' },
    rangeOptions: { control: false },
    subscriptions: { control: 'object' },
    invoices: { control: 'object' },
    onRangeChange: { control: false },
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
  subscriptionsStatus: PanelStatus
  invoicesStatus: PanelStatus
  dayCount: number
  plansShown: number
  contractsPerDay: number
  paid: number
  open: number
  overdue: number
  onRangeChange: (range: string) => void
  onNavigate: (path: string) => void
}

/** Builds both panels from the playground args; non-ready panels carry no data, as in the real page. */
function makePanels(args: PlaygroundArgs): Pick<DashboardHomeProps, 'subscriptions' | 'invoices'> {
  const labels = Array.from({ length: args.dayCount }, (_, index) => `Day ${index + 1}`)
  const plans = PLAN_POOL.slice(0, args.plansShown)
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

/** Keeps the range filter live so the select in the page actually changes. */
function PlaygroundHome(args: PlaygroundArgs) {
  const [range, setRange] = useState(args.range)
  useEffect(() => setRange(args.range), [args.range])

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
    subscriptionsStatus: 'ready',
    invoicesStatus: 'ready',
    dayCount: 7,
    plansShown: 4,
    contractsPerDay: 2,
    paid: 34,
    open: 15,
    overdue: 7,
    onRangeChange: fn(),
    onNavigate: fn(),
  },
  argTypes: {
    range: { control: 'inline-radio', options: RANGE_OPTIONS.map((option) => option.id) },
    subscriptionsStatus: { control: 'select', options: PANEL_STATUSES },
    invoicesStatus: { control: 'select', options: PANEL_STATUSES },
    dayCount: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    plansShown: { control: { type: 'range', min: 0, max: PLAN_POOL.length, step: 1 } },
    contractsPerDay: { control: { type: 'range', min: 1, max: 6, step: 1 } },
    paid: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    open: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    overdue: { control: { type: 'number', min: 0, max: 500, step: 1 } },
    onRangeChange: { control: false },
    onNavigate: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'range',
        'subscriptionsStatus',
        'invoicesStatus',
        'dayCount',
        'plansShown',
        'contractsPerDay',
        'paid',
        'open',
        'overdue',
        'onRangeChange',
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

    for (const heading of ['Recent contracts', 'Invoice payment status']) {
      await expect(canvas.getByRole('heading', { name: heading })).toBeInTheDocument()
    }

    // The metrics strip is gone; the range select stays because it still cuts both cards.
    await expect(canvas.queryByRole('heading', { name: 'Key metrics' })).toBeNull()
    await expect(canvas.queryByRole('tab')).toBeNull()
    await expect(canvas.getByRole('combobox', { name: 'Range' })).toBeInTheDocument()
    await expect(canvas.queryByRole('combobox', { name: 'Granularity' })).toBeNull()
    await expect(canvas.queryByRole('combobox', { name: 'Customer' })).toBeNull()

    // Parked until quota-based metrics land.
    await expect(canvas.queryByRole('heading', { name: 'Usage by feature' })).toBeNull()
    await expect(canvas.queryByRole('heading', { name: 'API' })).toBeNull()

    // The contracts headline is the total it was given.
    await expect(canvas.getByText('38')).toBeInTheDocument()

    // The invoice gauge's centre total equals the sum of its three buckets.
    await expect(canvas.getByText('56')).toBeInTheDocument()
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

/** Nothing yet, over the widest range on offer, so "none" can be read as "never". */
export const FirstRun: Story = {
  args: {
    range: '30d',
    rangeLabel: 'last 30 days',
    subscriptions: { status: 'empty', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'empty', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No contracts were created in this period.')).toBeInTheDocument()
    await expect(canvas.getByText('No invoices in this period.')).toBeInTheDocument()

    // Nothing is claimed: no "0 new contracts" and no "0" in the invoice ring,
    // and there is no wider range to offer.
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.queryByRole('button', { name: /^Show last/ })).toBeNull()
  },
}

/** The window is empty but a wider one might not be: the wider range is offered. */
export const PeriodEmpty: Story = {
  args: {
    subscriptions: { status: 'empty', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'empty', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No contracts were created in this period.')).toBeInTheDocument()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Show last 30 days' })[0]!)
    await expect(args.onRangeChange).toHaveBeenCalledWith('30d')
  },
}

/**
 * Every query is in flight. Bars where the numbers go, a skeleton where the
 * chart goes, and no zeroes.
 */
export const Loading: Story = {
  args: {
    subscriptions: { status: 'loading', total: 0, changePercent: null, days: [], plans: [] },
    invoices: { status: 'loading', total: 0, paid: 0, open: 0, overdue: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Loading new contracts' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('status').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.queryByText('—')).toBeNull()
  },
}

/**
 * Part of the page failed. The contracts card says so with a retry while the
 * invoice ring, which loaded, stays on screen.
 */
export const PartialFailure: Story = {
  args: {
    subscriptions: {
      status: 'unavailable',
      total: 0,
      changePercent: null,
      days: [],
      plans: [],
      onRetry: fn(),
    },
    invoices: { ...invoices, basedOn: 'Based on the latest 100 invoices.' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Contracts could not be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('56')).toBeInTheDocument()
    await expect(canvas.getByText('Based on the latest 100 invoices.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.subscriptions.onRetry).toHaveBeenCalled()
  },
}

/** A refresh failed over good data: the figures stay, with their age and a retry. */
export const StaleKeepsData: Story = {
  args: {
    invoices: { ...invoices, stale: true, updatedAt: Date.now() - 5 * 60_000, onRetry: fn() },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Couldn’t refresh/)).toBeInTheDocument()
    await expect(canvas.getByText('56')).toBeInTheDocument()
    await expect(canvas.queryByText('Invoices could not be loaded.')).toBeNull()
  },
}

/** Every query failed. The panels say so, with a way to ask again, rather than rendering zeroes. */
export const Unavailable: Story = {
  args: {
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
    await expect(canvas.getByText('Contracts could not be loaded.')).toBeInTheDocument()
    await expect(canvas.getByText('Invoices could not be loaded.')).toBeInTheDocument()
    await expect(canvas.queryByText('0')).toBeNull()
    await userEvent.click(canvas.getAllByRole('button', { name: /try again/i })[0]!)
    await expect(args.subscriptions.onRetry).toHaveBeenCalled()
  },
}

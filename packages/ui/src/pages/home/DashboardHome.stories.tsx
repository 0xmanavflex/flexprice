import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DashboardHome } from './DashboardHome'
import type {
  CustomersPanel,
  EventsPanel,
  InvoicesPanel,
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

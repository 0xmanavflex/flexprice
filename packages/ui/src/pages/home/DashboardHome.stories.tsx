import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { money } from '@fp/domain'
import { DashboardHome } from './DashboardHome'
import type { CustomersPanel, EventsPanel } from './DashboardHome'

/**
 * Home — the console overview.
 *
 * The states below are the reason this component takes data rather than
 * fetching it. `Populated` and `FirstRun` are the two the design specified, and
 * `Unavailable` is the one the product actually needs most: what the metric
 * chart looks like when Flexprice has no answer.
 *
 * The overview is three metrics — Revenue, Customers, Usage ingestion — and
 * nothing under them.
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

const customers: CustomersPanel = {
  status: 'ready',
  total: 1_284,
  points: [3, 5, 2, 6, 4, 7, 5].map((value, index) => ({ label: DAYS[index]!, customers: value })),
}

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

/** Every metric has data. */
export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Overview metrics' })).toBeInTheDocument()

    // The stat strip is the tab strip, in reading order: Revenue, Customers,
    // Usage ingestion. Each reads the total it was given, compactly.
    const tabs = canvas.getAllByRole('tab').map((tab) => tab.textContent ?? '')
    await expect(tabs[0]).toMatch(/Revenue/)
    await expect(tabs[1]).toMatch(/Customers/)
    await expect(tabs[2]).toMatch(/Usage ingestion/)
    await expect(canvas.getByText('1.3K')).toBeInTheDocument()
    await expect(canvas.getByText('5.1M')).toBeInTheDocument()
    await expect(canvas.getAllByRole('tab')).toHaveLength(3)
  },
}

/** Nothing below the metric chart: the cards that used to follow it are gone. */
export const NoCardsBelow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Recent contracts', 'Invoice payment status', 'Usage by feature', 'API']) {
      await expect(canvas.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
  },
}

/**
 * Switching metric switches the plot.
 *
 * Revenue has no series — the usage API prices a window as a whole — so this
 * also pins down that selecting it says so rather than drawing a flat line.
 */
export const SwitchesMetric: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /Revenue/ }))
    await expect(
      canvas.getByText(
        'Revenue is priced for the window as a whole; the usage API returns no per-bucket figure to plot.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('tab', { name: /Customers/ }))
    await expect(canvas.getByText('New customers, last 7 days.')).toBeInTheDocument()
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

/**
 * Nothing ingested yet.
 *
 * The first-run variant: dashes in the stat strip and the invitation over a
 * dimmed chart.
 */
export const FirstRun: Story = {
  args: {
    events: { status: 'empty', points: [], total: null, revenue: null },
    customers: { status: 'empty', total: 0, points: [] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('No events yet')).toBeInTheDocument()

    // Nothing is claimed: the quickstart is offered rather than a number guessed.
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

/** Every query failed. The chart says so rather than rendering zeroes. */
export const Unavailable: Story = {
  args: {
    events: { status: 'unavailable', points: [], total: null, revenue: null },
    customers: { status: 'unavailable', total: null, points: [] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Usage analytics unavailable')).toBeInTheDocument()
  },
}

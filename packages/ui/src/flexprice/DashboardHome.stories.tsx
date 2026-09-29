import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DashboardHome } from './DashboardHome'

/**
 * Home — the console overview.
 *
 * KPI strip, a revenue trend, revenue by customer, subscriptions by plan, and
 * metered usage, composed from the same parts every other surface uses. The data
 * is representative sample data held in the module, ready to be swapped for real
 * queries.
 */
const meta = {
  title: 'Surfaces/DashboardHome',
  component: DashboardHome,
  parameters: { layout: 'fullscreen' },
  args: { onNavigate: fn() },
  // The overview owns its scroll (the shell's content region does not scroll for
  // it), so the story gives it a bounded, scrollable frame to render into.
  decorators: [
    (Story) => (
      <div className="h-screen overflow-y-auto bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DashboardHome>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The surface's sections are all present and titled.
    for (const heading of [
      'Revenue',
      'Revenue by customer',
      'Subscriptions created',
      'Top metered features',
      'Track your costs',
    ]) {
      await expect(canvas.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  },
}

/** The cost-tracking nudge routes to where a cost sheet is created. */
export const AddsCostSheet: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add cost sheet' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('/cost-sheets')
  },
}

/**
 * The period picker drives the whole surface: the subscriptions section names the
 * selected range, so changing it is a real interaction, not a label swap.
 */
export const SwitchesPeriod: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Defaults to the quarter.
    await expect(canvas.getByText(/new subscriptions this quarter, by plan\./i)).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('combobox', { name: 'Period' }))
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Last 7 days' }))

    await waitFor(() =>
      expect(canvas.getByText(/new subscriptions last 7 days, by plan\./i)).toBeInTheDocument(),
    )
  },
}

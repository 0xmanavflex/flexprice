import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { RevenueDashboard } from './RevenueDashboard'

/**
 * Revenue — the report behind the overview's headline number: KPI strip, the
 * contract/usage mix, revenue by customer, and margin by feature. Sample data.
 */
const meta = {
  title: 'Surfaces/RevenueDashboard',
  component: RevenueDashboard,
  parameters: { layout: 'padded' },
  args: { onNavigate: fn() },
} satisfies Meta<typeof RevenueDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const heading of ['Revenue mix', 'Revenue by customer', 'Gross margin by feature']) {
      await expect(canvas.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  },
}

/** The margin section routes to cost sheets, where the cost side is defined. */
export const OpensCostSheets: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Cost sheets' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('/cost-sheets')
  },
}

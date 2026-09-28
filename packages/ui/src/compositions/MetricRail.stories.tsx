import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { MetricRail } from './MetricRail'

/**
 * The metric rail leads a detail page with numbers, not attributes. These
 * stories are the shapes it takes across entities — a plan's money and counts,
 * a coupon's redemptions.
 */
const meta = {
  title: 'Foundation/Compositions/MetricRail',
  component: MetricRail,
  parameters: { layout: 'padded' },
  args: {
    metrics: [
      { label: 'Active subscriptions', value: '128', hint: '+12 this month', sentiment: 'positive' },
      { label: 'MRR', value: '$4,210' },
      { label: 'Starts at', value: '$29', hint: 'per month' },
      { label: 'Charges', value: '3' },
    ],
  },
} satisfies Meta<typeof MetricRail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Redemptions: Story = {
  args: {
    metrics: [
      { label: 'Redemptions', value: '213', hint: 'of 500' },
      { label: 'Redemption rate', value: '43%' },
      { label: 'Total discounted', value: '$1,240' },
    ],
  },
}

export const LeadsWithNumbers: Story = {
  play: async ({ canvasElement }) => {
    // The value, not the label, is the large element — a KPI, not a field.
    await expect(within(canvasElement).getByText('128')).toBeInTheDocument()
  },
}

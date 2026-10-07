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
      {
        label: 'Active contracts',
        value: '128',
        hint: '+12 this month',
        sentiment: 'positive',
      },
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

/**
 * Omit the rail rather than fake it.
 *
 * This is the shape an unpriced add-on used to open on: two zeros and two
 * em-dashes, no information, and ~310px of a 390px phone screen spent before
 * any real content. A rail where every tile is blank is not a rail.
 */
export const OmittedWhenEveryTileIsBlank: Story = {
  args: {
    metrics: [
      { label: 'Charges', value: '0' },
      { label: 'Starts at', value: '—' },
      { label: 'Currency', value: '—' },
      { label: 'Entitlements', value: '0' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Charges')).not.toBeInTheDocument()
    await expect(canvas.queryByText('Entitlements')).not.toBeInTheDocument()
  },
}

/** One real number is enough to earn the rail — the blank tiles ride along. */
export const OneRealValueKeepsTheRail: Story = {
  args: {
    metrics: [
      { label: 'Charges', value: '0' },
      { label: 'Entitlements', value: '4' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('4')).toBeInTheDocument()
    await expect(canvas.getByText('Charges')).toBeInTheDocument()
  },
}

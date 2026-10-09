import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CouponRedemptionMeter } from './CouponRedemptionMeter'

const meta = {
  title: 'App/Settings/Discounts/Redemption meter',
  component: CouponRedemptionMeter,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  args: { redeemed: 42, max: 100 },
  argTypes: {
    redeemed: { control: { type: 'number', min: 0, step: 1 } },
    max: { control: { type: 'number', min: 0, step: 1 } },
  },
} satisfies Meta<typeof CouponRedemptionMeter>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  redeemed: number
  max: number
  unlimited: boolean
}

/** Drag redeemed and max: under, at and over the ceiling, or tick unlimited. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { redeemed: 42, max: 100, unlimited: false },
  argTypes: {
    redeemed: { control: { type: 'number', min: 0, step: 1 } },
    max: { control: { type: 'number', min: 0, step: 1 } },
    unlimited: { control: 'boolean', description: 'No ceiling: the meter drops its bar.' },
  },
  render: ({ redeemed, max, unlimited }) => (
    <CouponRedemptionMeter redeemed={redeemed} max={unlimited ? null : max} />
  ),
}

export const PartlyUsed: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('58 left')).toBeInTheDocument()
  },
}

export const Unused: Story = { args: { redeemed: 0, max: 100 } }

/** Fully redeemed: the bar is full and nothing is left. */
export const Exhausted: Story = {
  args: { redeemed: 100, max: 100 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('0 left')).toBeInTheDocument()
  },
}

/** Redeemed past the ceiling: the bar caps at 100% and "left" never goes negative. */
export const OverLimit: Story = { args: { redeemed: 130, max: 100 } }

/** No ceiling: no bar, just the count. */
export const Unlimited: Story = {
  args: { redeemed: 1284, max: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No redemption limit')).toBeInTheDocument()
  },
}

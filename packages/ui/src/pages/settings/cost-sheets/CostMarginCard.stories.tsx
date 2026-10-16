import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CostMarginCard } from './CostMarginCard'

const meta = {
  title: 'App/Settings/Cost sheets/Cost margin card',
  component: CostMarginCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CostMarginCard>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  currency: string
  revenue: number
  cost: number
}

/** Drag revenue and cost to push the margin positive, zero or negative. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: { currency: 'USD', revenue: 12400, cost: 4650 },
  argTypes: {
    currency: { control: 'inline-radio', options: ['USD', 'EUR', 'GBP', 'INR'] },
    revenue: { control: { type: 'number', min: 0, step: 100 } },
    cost: { control: { type: 'number', min: 0, step: 100 } },
  },
  render: ({ currency, revenue, cost }) => <CostMarginCard margin={{ currency, revenue, cost }} />,
}

/** No margin source exists yet: the card says so instead of showing sample numbers. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Margin is not available yet')).toBeInTheDocument()
    await expect(canvas.queryByText(/%/)).toBeNull()
  },
}

/** A real margin, once a source exists. */
export const WithMargin: Story = {
  args: { margin: { currency: 'USD', revenue: 12400, cost: 4650 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('62.5%')).toBeInTheDocument()
  },
}

/** Cost above revenue gives a negative margin. */
export const NegativeMargin: Story = {
  args: { margin: { currency: 'USD', revenue: 1000, cost: 1800 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('-80.0%')).toBeInTheDocument()
  },
}

/** No revenue yet: the percentage reads 0.0% instead of dividing by zero. */
export const NoRevenue: Story = {
  args: { margin: { currency: 'USD', revenue: 0, cost: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('0.0%')).toBeInTheDocument()
  },
}

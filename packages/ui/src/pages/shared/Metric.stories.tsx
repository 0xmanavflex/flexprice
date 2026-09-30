import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money } from '@fp/domain'
import { Metric } from './Metric'
import { Money } from './Money'

const meta = {
  title: 'Foundation/Flexprice/Metric',
  component: Metric,
  parameters: { layout: 'centered' },
  args: { label: 'Billed this month', value: <Money value={money('48250.00', 'USD')} locale="en-US" /> },
} satisfies Meta<typeof Metric>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = { args: { isLoading: true } }

/**
 * Direction and sentiment are separate inputs.
 *
 * Up is good for revenue and bad for failed payments. V1's metric cards infer
 * sentiment from the sign, which is wrong half the time.
 */
export const DirectionIsNotSentiment: Story = {
  render: () => (
    <div className="flex gap-4">
      <Metric
        label="Revenue"
        value="$48,250"
        change={{ label: '12%', direction: 'up', sentiment: 'positive' }}
      />
      <Metric
        label="Failed payments"
        value="37"
        change={{ label: '12%', direction: 'up', sentiment: 'negative' }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Both rose; only one is bad. The arrow is identical, the meaning is not.
    await expect(within(canvasElement).getAllByText('12%')).toHaveLength(2)
  },
}

/** Direction is announced, not only drawn. */
export const AnnouncesDirection: Story = {
  args: { change: { label: '8%', direction: 'down', sentiment: 'negative' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/decrease/)).toBeInTheDocument()
  },
}

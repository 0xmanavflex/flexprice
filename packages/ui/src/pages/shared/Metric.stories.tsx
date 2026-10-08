import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money } from '@fp/domain'
import { Metric } from './Metric'
import { Money } from './Money'

const meta = {
  title: 'Foundation/Flexprice/Metric',
  component: Metric,
  parameters: { layout: 'centered' },
  args: {
    label: 'Billed this month',
    value: <Money value={money('48250.00', 'USD')} locale="en-US" />,
  },
  argTypes: {
    label: { control: 'text' },
    value: { control: false },
    hint: { control: 'text' },
    change: { control: 'object' },
    isLoading: { control: 'boolean' },
  },
} satisfies Meta<typeof Metric>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  label: string
  amount: string
  currency: string
  hint: string
  isLoading: boolean
  showChange: boolean
  changeLabel: string
  direction: 'up' | 'down'
  sentiment: 'positive' | 'negative' | 'neutral'
}

/** Direction and sentiment are independent controls: try "up" with "negative". */
export const Playground = {
  args: {
    label: 'Billed this month',
    amount: '48250.00',
    currency: 'USD',
    hint: 'vs. last month',
    isLoading: false,
    showChange: true,
    changeLabel: '12%',
    direction: 'up',
    sentiment: 'positive',
  },
  argTypes: {
    label: { control: 'text' },
    amount: { control: 'text', description: 'Plain decimal string, e.g. 48250.00.' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY'] },
    hint: { control: 'text' },
    isLoading: { control: 'boolean' },
    showChange: { control: 'boolean' },
    changeLabel: { control: 'text' },
    direction: { control: 'inline-radio', options: ['up', 'down'] },
    sentiment: { control: 'inline-radio', options: ['positive', 'negative', 'neutral'] },
  },
  parameters: {
    controls: {
      include: [
        'label',
        'amount',
        'currency',
        'hint',
        'isLoading',
        'showChange',
        'changeLabel',
        'direction',
        'sentiment',
      ],
    },
  },
  render: ({
    label,
    amount,
    currency,
    hint,
    isLoading,
    showChange,
    changeLabel,
    direction,
    sentiment,
  }) => {
    const value = /^-?\d+(\.\d+)?$/.test(amount) ? amount : '0'
    return (
      <div className="w-56">
        <Metric
          label={label}
          value={<Money value={money(value, currency)} locale="en-US" />}
          hint={hint}
          isLoading={isLoading}
          {...(showChange ? { change: { label: changeLabel, direction, sentiment } } : {})}
        />
      </div>
    )
  },
} satisfies StoryObj<PlaygroundArgs>

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

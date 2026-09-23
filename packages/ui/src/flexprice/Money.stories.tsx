import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { money } from '@fp/domain'
import { Money } from './Money'

const meta = {
  title: 'Foundation/Flexprice/Money',
  component: Money,
  parameters: { layout: 'centered' },
  args: { value: money('1234.56', 'USD'), locale: 'en-US' },
} satisfies Meta<typeof Money>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The reason this component refuses numbers. */
export const ExactDecimal: Story = {
  args: { value: money('12345678901234567.89', 'USD') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$12,345,678,901,234,567.89')).toBeInTheDocument()
    // What a float would have rendered instead.
    await expect(canvas.queryByText('$12,345,678,901,234,568.00')).not.toBeInTheDocument()
  },
}

export const Currencies: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Money value={money('1234.56', 'USD')} locale="en-US" />
      <Money value={money('1234.56', 'EUR')} locale="de-DE" />
      <Money value={money('1234.56', 'INR')} locale="en-IN" />
      <Money value={money('1234', 'JPY')} locale="ja-JP" />
    </div>
  ),
}

export const Zero: Story = { args: { value: money('0', 'USD'), muteZero: true } }

/** Sign carries meaning for credits and refunds. */
export const Negative: Story = { args: { value: money('-250.00', 'USD'), signed: true } }

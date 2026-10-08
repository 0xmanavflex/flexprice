import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TrendBadge } from './charts'

const meta = {
  title: 'Foundation/Flexprice/TrendBadge',
  component: TrendBadge,
  parameters: { layout: 'centered' },
  args: { percent: 12.5 },
  argTypes: {
    percent: {
      control: { type: 'number', min: -100, max: 1000, step: 0.1 },
      description: 'Change in percent; the sign picks the arrow and the colour.',
    },
  },
} satisfies Meta<typeof TrendBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Drag the percent through zero: arrow, colour and the explicit "+" all follow the sign. */
export const Playground: Story = {
  args: { percent: 4.2 },
  argTypes: { percent: { control: { type: 'range', min: -100, max: 100, step: 0.1 } } },
}

/** Growth: up arrow, success tint, explicit plus. */
export const Positive: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('+12.5%')).toBeVisible()
  },
}

/** Decline: down arrow, destructive tint, the sign carried by the minus as well as colour. */
export const Negative: Story = {
  args: { percent: -3.2 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('-3.2%')).toBeVisible()
  },
}

/** Zero counts as non-negative: shown as +0%. */
export const Zero: Story = {
  args: { percent: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('+0%')).toBeVisible()
  },
}

/** Rounded to one decimal place. */
export const RoundsToOneDecimal: Story = {
  args: { percent: 3.14159 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('+3.1%')).toBeVisible()
  },
}

/** Large figures are grouped by the locale. */
export const LargeValue: Story = {
  args: { percent: 1234.5 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('+1,234.5%')).toBeVisible()
  },
}

/** Side by side, as in a metric tab row. */
export const Both: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <TrendBadge percent={18} />
      <TrendBadge percent={-7.5} />
    </div>
  ),
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DetailStats, type DetailStat, type DetailStatsProps } from './DetailStats'

type PlaygroundArgs = DetailStatsProps & {
  /** How many figures to show (1-6). */
  count: number
}

const FIGURES: DetailStat[] = [
  { label: 'MRR', value: '$12,480.00' },
  { label: 'Active subscriptions', value: '4' },
  { label: 'Outstanding', value: '$1,230.50' },
  { label: 'Credit balance', value: '$300.00' },
  { label: 'Open invoices', value: '2' },
  { label: 'Customer since', value: 'Mar 2024' },
]

const meta = {
  title: 'Foundation/Compositions/DetailStats',
  component: DetailStats,
  parameters: { layout: 'padded' },
  argTypes: {
    count: { control: { type: 'number', min: 1, max: 6, step: 1 } },
    className: { control: 'text' },
    stats: { control: false },
  },
  args: { count: 4, stats: [] },
  render: ({ count, ...args }) => (
    <DetailStats {...args} stats={FIGURES.slice(0, Math.min(6, Math.max(1, count)))} />
  ),
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Change `count` from 1 to 6; the grid switches between 2, 3 and 4 columns. */
export const Playground: Story = {}

/** Four figures: the usual summary row. */
export const FourFigures: Story = {
  args: { count: 4 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('MRR')).toBeVisible()
    await expect(canvas.getByText('$12,480.00')).toBeVisible()
    await expect(canvasElement.querySelectorAll('dt')).toHaveLength(4)
  },
}

/** Three figures take three equal columns. */
export const ThreeFigures: Story = { args: { count: 3 } }

/** Two figures take two equal columns. */
export const TwoFigures: Story = { args: { count: 2 } }

/** Six figures wrap onto a second row on narrow screens. */
export const SixFigures: Story = { args: { count: 6 } }

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PillColumns } from './PillColumns'
import type { PillColumn } from './PillColumns'

const series = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'scale', label: 'Scale' },
]

const columns: PillColumn[] = [
  { label: 'Mon', values: { starter: 12, growth: 7, scale: 2 } },
  { label: 'Tue', values: { starter: 9, growth: 11, scale: 4 } },
  { label: 'Wed', values: { starter: 15, growth: 9, scale: 3 } },
  { label: 'Thu', values: { starter: 6, growth: 5, scale: 1 } },
  { label: 'Fri', values: { starter: 18, growth: 14, scale: 6 } },
  { label: 'Sat', values: { starter: 4, growth: 2, scale: 0 } },
  { label: 'Sun', values: { starter: 3, growth: 1, scale: 0 } },
]

const meta = {
  title: 'Foundation/Flexprice/PillColumns',
  component: PillColumns,
  parameters: { layout: 'padded' },
  args: { columns, series, label: 'New subscriptions by day and plan' },
} satisfies Meta<typeof PillColumns>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * Identity never rests on colour: the legend names every series, and each
 * column carries its full breakdown as an accessible name.
 */
export const LegendAndReadings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const item of series) {
      await expect(canvas.getByText(item.label)).toBeInTheDocument()
    }
    await expect(
      canvas.getByRole('button', { name: /Fri: 38 total, Starter 18, Growth 14, Scale 6/ }),
    ).toBeInTheDocument()
  },
}

/** Two series is where a legend starts mattering, and the common revenue case. */
export const TwoSeries: Story = {
  args: {
    series: [
      { id: 'recurring', label: 'Recurring' },
      { id: 'usage', label: 'Usage' },
    ],
    columns: [
      { label: 'Jan', values: { recurring: 42000, usage: 11000 } },
      { label: 'Feb', values: { recurring: 45000, usage: 15500 } },
      { label: 'Mar', values: { recurring: 47500, usage: 21000 } },
      { label: 'Apr', values: { recurring: 51000, usage: 26500 } },
    ],
    label: 'Revenue by month and kind',
  },
}

/** A column whose parts are tiny still shows them — one segment, never none. */
export const SmallShares: Story = {
  args: {
    columns: [
      { label: 'Mon', values: { starter: 400, growth: 3, scale: 1 } },
      { label: 'Tue', values: { starter: 380, growth: 2, scale: 1 } },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Mon: 404 total, Starter 400, Growth 3, Scale 1/ }),
    ).toBeInTheDocument()
  },
}

/** Every column zero: bare tracks, no phantom bars, and the labels still read. */
export const AllZero: Story = {
  args: {
    columns: columns.map((column) => ({
      label: column.label,
      values: { starter: 0, growth: 0, scale: 0 },
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Mon: 0 total, Starter 0, Growth 0, Scale 0/ }),
    ).toBeInTheDocument()
  },
}

/** No columns at all — the legend survives so the panel is still self-describing. */
export const NoColumns: Story = {
  args: { columns: [] },
}

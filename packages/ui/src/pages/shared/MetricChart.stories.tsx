import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { MetricChart } from './charts'
import type { MetricPoint, MetricTab } from './charts'

const days = [
  'Mar 1',
  'Mar 2',
  'Mar 3',
  'Mar 4',
  'Mar 5',
  'Mar 6',
  'Mar 7',
  'Mar 8',
  'Mar 9',
  'Mar 10',
  'Mar 11',
  'Mar 12',
]

/** Deterministic, so a visual diff is about the component and not the numbers. */
function series(base: number, spread: number): MetricPoint[] {
  return days.map((label, index) => ({
    label,
    value: Math.round(base + Math.sin(index / 1.7) * spread + index * (spread / 9)),
  }))
}

const tabs: MetricTab[] = [
  {
    id: 'events',
    label: 'Events',
    value: '1.24M',
    changePercent: 12.4,
    points: series(94000, 21000),
  },
  { id: 'invoices', label: 'Invoices', value: '842', changePercent: -3.1, points: series(70, 18) },
  {
    id: 'subscriptions',
    label: 'Contracts',
    value: '319',
    changePercent: 5.8,
    points: series(26, 7),
  },
]

const meta = {
  title: 'Foundation/Flexprice/MetricChart',
  component: MetricChart,
  parameters: { layout: 'padded' },
  args: {
    tabs,
    activeTab: 'events',
    onTabChange: fn(),
    caption: 'Last 12 days, UTC.',
  },
} satisfies Meta<typeof MetricChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * The page owns the selection, so the story plays the page: it holds the state
 * and hands it back down. The component itself never remembers which tab you
 * picked, which is what lets a page put it in the URL.
 */
export const Controlled: Story = {
  render: function Controlled(args) {
    const [active, setActive] = useState(args.activeTab)
    return (
      <MetricChart
        {...args}
        activeTab={active}
        onTabChange={(id) => {
          setActive(id)
          args.onTabChange(id)
        }}
      />
    )
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('tab', { name: /invoices/i }))
    await expect(args.onTabChange).toHaveBeenCalledWith('invoices')
    // The plot follows the tab, not just the highlight.
    await expect(canvas.getByRole('img', { name: /invoices over 12 buckets/i })).toBeInTheDocument()
  },
}

/** Every tab is a tab, and only the selected one exposes a panel. */
export const TabSemantics: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('tab')).toHaveLength(3)
    await expect(canvas.getByRole('tab', { name: /events/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  },
}

/** A window with nothing in it. The panel keeps its height and says so. */
export const NoData: Story = {
  args: {
    tabs: tabs.map((tab) => ({ ...tab, value: '0', points: [] })),
    activeTab: 'events',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: /no data for this period/i })).toBeInTheDocument()
  },
}

/** A real series that happens to be flat at zero — not the same as no series. */
export const AllZero: Story = {
  args: {
    tabs: [
      {
        id: 'events',
        label: 'Events',
        value: '0',
        points: days.map((label) => ({ label, value: 0 })),
      },
    ],
    activeTab: 'events',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: /events over 12 buckets/i })).toBeInTheDocument()
  },
}

/** No prior window to compare against, so no trend badge is invented. */
export const WithoutTrend: Story = {
  args: {
    tabs: tabs.map(({ changePercent: _unused, ...tab }) => tab),
  },
}

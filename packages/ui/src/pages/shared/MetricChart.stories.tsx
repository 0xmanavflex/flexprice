import { useEffect, useState } from 'react'
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

const allTabs: MetricTab[] = [
  ...tabs,
  { id: 'customers', label: 'Customers', value: '1,204', changePercent: 2.2, points: [] },
  { id: 'payments', label: 'Payments', value: '611', changePercent: -8.4, points: [] },
  { id: 'wallets', label: 'Wallets', value: '88', points: [] },
]

/** Deterministic series with `count` buckets, so the playground can grow the x axis. */
function seriesOf(count: number, base: number, spread: number): MetricPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    label: `Day ${index + 1}`,
    value: Math.round(base + Math.sin(index / 1.7) * spread + index * (spread / 9)),
  }))
}

interface PlaygroundArgs {
  tabCount: number
  pointCount: number
  activeTab: string
  showTrend: boolean
  height: number
  caption: string
}

function PlaygroundChart({
  tabCount,
  pointCount,
  activeTab,
  showTrend,
  height,
  caption,
  onTabChange,
}: PlaygroundArgs & { onTabChange: (id: string) => void }) {
  const [active, setActive] = useState(activeTab)
  useEffect(() => setActive(activeTab), [activeTab])

  const shown = allTabs.slice(0, tabCount).map((tab, index) => {
    const { changePercent, ...rest } = tab
    return {
      ...rest,
      points: seriesOf(pointCount, 80 + index * 40, 20 + index * 6),
      ...(showTrend && changePercent !== undefined ? { changePercent } : {}),
    }
  })

  return (
    <MetricChart
      tabs={shown}
      activeTab={active}
      onTabChange={(id) => {
        setActive(id)
        onTabChange(id)
      }}
      height={height}
      caption={caption}
    />
  )
}

const meta = {
  title: 'Building blocks/Charts & metrics/MetricChart',
  component: MetricChart,
  parameters: { layout: 'padded' },
  args: {
    tabs,
    activeTab: 'events',
    onTabChange: fn(),
    caption: 'Last 12 days, UTC.',
  },
  argTypes: {
    tabs: { control: false },
    activeTab: { control: 'select', options: allTabs.map((tab) => tab.id) },
    onTabChange: { control: false },
    caption: { control: 'text' },
    height: { control: { type: 'range', min: 120, max: 480, step: 10 } },
    className: { control: false },
  },
} satisfies Meta<typeof MetricChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Tabs 1-6, points 0-60 (0 is the no-data state), trend badges and plot height are all live; clicking a tab works. */
export const Playground = {
  args: {
    tabCount: 3,
    pointCount: 12,
    activeTab: 'events',
    showTrend: true,
    height: 260,
    caption: 'Last 12 days, UTC.',
    onTabChange: fn(),
  },
  argTypes: {
    tabCount: { control: { type: 'range', min: 1, max: 6, step: 1 } },
    pointCount: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    activeTab: { control: 'select', options: allTabs.map((tab) => tab.id) },
    showTrend: { control: 'boolean' },
    height: { control: { type: 'range', min: 120, max: 480, step: 10 } },
    caption: { control: 'text' },
    onTabChange: { control: false },
  },
  render: (args) => <PlaygroundChart {...args} />,
} satisfies StoryObj<PlaygroundArgs & { onTabChange: (id: string) => void }>

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

/** A real series that happens to be flat at zero: not the same as no series. */
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

/**
 * Still loading: the headline is a placeholder and the plot a shapeless
 * skeleton. Neither a "0" nor a flat line is drawn for a figure not yet known.
 */
export const Loading: Story = {
  args: {
    tabs: tabs.map(({ id, label }) => ({ id, label, value: '', points: [], status: 'loading' })),
    activeTab: 'events',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('status').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('0')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('img', { name: /no data/i })).not.toBeInTheDocument()
  },
}

/** A failed tab says so, offers a retry, and does not claim the window was empty. */
export const Unavailable: Story = {
  args: {
    tabs: tabs.map((tab, index) =>
      index === 0
        ? {
            id: tab.id,
            label: tab.label,
            value: '',
            points: [],
            status: 'unavailable',
            onRetry: fn(),
          }
        : tab,
    ),
    activeTab: 'events',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent(/couldn.t be loaded/i)
    await expect(canvas.queryByText(/no events in this period/i)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.tabs[0]?.onRetry).toHaveBeenCalled()
  },
}

/** A ready tab with no series can say something truer than "No events in this period". */
export const CustomEmptyMessage: Story = {
  args: {
    tabs: tabs.map((tab) => ({
      ...tab,
      points: [],
      emptyMessage: 'No usage for this customer in this period',
    })),
    activeTab: 'events',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: /no usage for this customer in this period/i }),
    ).toBeInTheDocument()
  },
}

/** Arrow keys, Home and End move between tabs, as a tablist is expected to. */
export const KeyboardNavigation: Story = {
  render: Controlled.render!,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('tab', { name: /events/i }).focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onTabChange).toHaveBeenLastCalledWith('invoices')
    await userEvent.keyboard('{End}')
    await expect(args.onTabChange).toHaveBeenLastCalledWith('subscriptions')
    await userEvent.keyboard('{Home}')
    await expect(args.onTabChange).toHaveBeenLastCalledWith('events')
  },
}

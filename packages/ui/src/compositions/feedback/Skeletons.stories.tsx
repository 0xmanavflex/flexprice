import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import {
  ChartSkeleton,
  InlineLoadingState,
  MetricCardSkeleton,
  PageLoadingState,
  TableSkeleton,
  ValuePlaceholder,
} from './Skeletons'

const meta = {
  title: 'Building blocks/Feedback & states/Skeletons',
  component: TableSkeleton,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TableSkeleton>

export default meta
type Story = StoryObj<typeof meta>

/** Column widths mirror the real table, so nothing moves when rows arrive. */
export const Table: Story = {
  args: {
    header: true,
    rows: 6,
    columns: [
      { width: '2fr', kind: 'avatar' },
      { width: '120px', kind: 'badge' },
      { width: '1fr' },
      { width: '140px', kind: 'money' },
      { width: '120px', kind: 'short' },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading')
  },
}

export const Metrics: StoryObj = {
  render: () => (
    <div className="grid max-w-xl grid-cols-3 gap-6">
      <MetricCardSkeleton delta />
      <MetricCardSkeleton delta />
      <MetricCardSkeleton />
    </div>
  ),
}

/** Gridlines and axis bones only: no curve, because any curve would read as the customer's data. */
export const Chart: StoryObj = { render: () => <ChartSkeleton /> }

export const PageList: StoryObj = { render: () => <PageLoadingState variant="list" /> }
export const PageDetail: StoryObj = { render: () => <PageLoadingState variant="detail" /> }
export const PageDashboard: StoryObj = { render: () => <PageLoadingState variant="dashboard" /> }

export const Inline: StoryObj = { render: () => <InlineLoadingState label="Loading wallets" /> }

/** A bar where a figure will be: never a zero, never a dash. */
export const Value: StoryObj = {
  render: () => (
    <p className="text-2xl font-semibold">
      <ValuePlaceholder width={9} label="Loading balance" />
    </p>
  ),
}

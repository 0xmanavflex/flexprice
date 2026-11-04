import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatCards } from './StatCards'

const STAT_LABELS = [
  'Coupons',
  'Active',
  'Archived',
  'Redeemed',
  'Expired',
  'Scheduled',
  'Draft',
  'Paused',
  'Flagged',
  'Reviewed',
  'Pending',
  'Closed',
]

const meta = {
  title: 'Building blocks/Charts & metrics/StatCards',
  component: StatCards,
  parameters: { layout: 'padded' },
  args: {
    stats: [
      { label: 'Coupons', value: 12 },
      { label: 'Active', value: 10 },
      { label: 'Archived', value: 2 },
    ],
    locale: 'en-US',
  },
  argTypes: {
    stats: { control: 'object' },
    isLoading: { control: 'boolean' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN'] },
  },
} satisfies Meta<typeof StatCards>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  count: number
  scale: number
  notCounted: boolean
  withHints: boolean
  isLoading: boolean
  locale: string
}

/** Drag count 0-12 to grow the strip, scale the numbers, or flip to not-counted and loading. */
export const Playground = {
  args: {
    count: 6,
    scale: 1000,
    notCounted: false,
    withHints: true,
    isLoading: false,
    locale: 'en-US',
  },
  argTypes: {
    count: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    scale: { control: { type: 'number', min: 1, max: 1_000_000, step: 100 } },
    notCounted: { control: 'boolean', description: 'Every value undefined, shown as a dash.' },
    withHints: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'en-IN'] },
  },
  parameters: {
    controls: { include: ['count', 'scale', 'notCounted', 'withHints', 'isLoading', 'locale'] },
  },
  render: ({ count, scale, notCounted, withHints, isLoading, locale }) => (
    <StatCards
      isLoading={isLoading}
      locale={locale}
      stats={Array.from({ length: count }, (_, index) => ({
        label: STAT_LABELS[index]!,
        value: notCounted ? undefined : (count - index) * scale + index * 7,
        ...(withHints ? { hint: `${index + 1} this week` } : {}),
      }))}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    await expect(canvas.getByText('Active')).toBeInTheDocument()
  },
}

/** A count not yet known reads as a dash, never a confident zero. */
export const Loading: Story = {
  args: {
    isLoading: true,
    stats: [
      { label: 'Coupons', value: undefined },
      { label: 'Active', value: undefined },
      { label: 'Archived', value: undefined },
    ],
  },
}

export const NotCounted: Story = {
  args: {
    stats: [
      { label: 'Coupons', value: undefined },
      { label: 'Active', value: undefined },
      { label: 'Archived', value: undefined },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('—').length).toBe(3)
  },
}

export const LargeNumbersGroup: Story = {
  args: {
    stats: [
      { label: 'Events', value: 1284093 },
      { label: 'This month', value: 84120 },
      { label: 'Failed', value: 312 },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1,284,093')).toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatCards } from './StatCards'

const meta = {
  title: 'Surfaces/StatCards',
  component: StatCards,
  parameters: { layout: 'padded' },
  args: {
    stats: [
      { label: 'Coupons', value: 12 },
      { label: 'Published', value: 10 },
      { label: 'Archived', value: 2 },
    ],
    locale: 'en-US',
  },
} satisfies Meta<typeof StatCards>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('12')).toBeInTheDocument()
    await expect(canvas.getByText('Published')).toBeInTheDocument()
  },
}

/** A count not yet known reads as a dash, never a confident zero. */
export const Loading: Story = {
  args: {
    isLoading: true,
    stats: [
      { label: 'Coupons', value: undefined },
      { label: 'Published', value: undefined },
      { label: 'Archived', value: undefined },
    ],
  },
}

export const NotCounted: Story = {
  args: {
    stats: [
      { label: 'Coupons', value: undefined },
      { label: 'Published', value: undefined },
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

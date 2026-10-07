import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CollectionsSummary } from './CollectionsSummary'

const meta = {
  title: 'Surfaces/CollectionsSummary',
  component: CollectionsSummary,
  parameters: { layout: 'padded' },
  args: {
    cells: [
      { label: 'Total outstanding', value: '$18,420.00', hint: '12 unpaid invoices' },
      {
        label: 'Total overdue',
        value: '$4,310.50',
        hint: '3 past their due date or failed',
        tone: 'danger',
      },
    ],
  },
} satisfies Meta<typeof CollectionsSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$18,420.00')).toBeVisible()
    await expect(canvas.getByText('3 past their due date or failed')).toBeVisible()
  },
}

export const Loading: Story = { args: { isLoading: true } }

export const NothingOwed: Story = {
  args: {
    cells: [
      { label: 'Total outstanding', value: '$0.00', hint: '0 unpaid invoices' },
      { label: 'Total overdue', value: '$0.00', hint: '0 past their due date or failed' },
    ],
  },
}

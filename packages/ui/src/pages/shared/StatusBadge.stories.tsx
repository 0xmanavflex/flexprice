import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { InvoiceStatus } from '@fp/domain'
import { InvoiceStatusBadge } from './StatusBadge'

const meta = {
  title: 'Foundation/Flexprice/InvoiceStatusBadge',
  component: InvoiceStatusBadge,
  parameters: { layout: 'centered' },
  args: { status: InvoiceStatus.Open },
} satisfies Meta<typeof InvoiceStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Only the status needing action is destructive. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.values(InvoiceStatus).map((status) => (
        <InvoiceStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
}

export const Overdue: Story = {
  args: { status: InvoiceStatus.Overdue },
  play: async ({ canvasElement }) => {
    // Colour alone cannot carry "this one needs you".
    await expect(within(canvasElement).getByText(/needs attention/)).toBeInTheDocument()
  },
}

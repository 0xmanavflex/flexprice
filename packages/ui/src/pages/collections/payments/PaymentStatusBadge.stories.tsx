import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PAYMENT_STATUS_LABEL, PaymentStatus } from '@fp/domain'
import { PaymentStatusBadge } from './PaymentStatusBadge'

const meta = {
  title: 'Surfaces/PaymentStatusBadge',
  component: PaymentStatusBadge,
  parameters: { layout: 'centered' },
  argTypes: {
    status: { control: 'select', options: Object.values(PaymentStatus) },
  },
  args: { status: PaymentStatus.Succeeded },
} satisfies Meta<typeof PaymentStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Pick a payment status; the dot tone follows it. */
export const Playground: Story = {}

/** Every payment status side by side: only a failure is destructive. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.values(PaymentStatus).map((status) => (
        <PaymentStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const label of Object.values(PAYMENT_STATUS_LABEL)) {
      await expect(canvas.getByText(label)).toBeInTheDocument()
    }
  },
}

export const Failed: Story = {
  args: { status: PaymentStatus.Failed },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Failed')).toBeInTheDocument()
  },
}

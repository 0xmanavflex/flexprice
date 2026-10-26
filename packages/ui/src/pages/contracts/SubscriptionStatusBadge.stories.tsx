import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatus } from '@fp/domain'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

/** A subscription's lifecycle as the shared status pill, coloured from the shared registry. */
const meta = {
  title: 'App/Contracts/Contract status badge',
  component: SubscriptionStatusBadge,
  parameters: { layout: 'centered' },
  args: { status: SubscriptionStatus.Active },
  argTypes: {
    status: { control: 'select', options: Object.values(SubscriptionStatus) },
  },
} satisfies Meta<typeof SubscriptionStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Pick a status from the control. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Active')).toBeVisible()
  },
}

/** Every lifecycle state side by side. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {Object.values(SubscriptionStatus).map((status) => (
        <SubscriptionStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const label of Object.values(SUBSCRIPTION_STATUS_LABEL)) {
      await expect(canvas.getByText(label)).toBeVisible()
    }
  },
}

export const Incomplete: Story = {
  args: { status: SubscriptionStatus.Incomplete },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Incomplete')).toBeVisible()
  },
}

/** Trialing carries the violet trial tone, the same dot as the contracts grid. */
export const Trialing: Story = {
  args: { status: SubscriptionStatus.Trialing },
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByTitle('Trialing')
    await expect(pill.querySelector('.bg-trial')).not.toBeNull()
    await expect(pill.querySelector('.bg-muted-foreground')).toBeNull()
  },
}

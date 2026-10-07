import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { SubscriptionStatus, type Subscription } from '@fp/domain'
import { SubscriptionCard } from './SubscriptionCard'

const base: Subscription = {
  id: 'sub_01',
  customerId: 'cus_01',
  customerName: 'Acme Robotics',
  planId: 'plan_starter',
  planName: 'Starter',
  status: SubscriptionStatus.Active,
  currency: 'USD',
  billingPeriodLabel: 'Monthly',
  currentPeriodStart: new Date('2026-09-04T00:00:00Z'),
  currentPeriodEnd: new Date('2026-10-04T00:00:00Z'),
  startDate: new Date('2025-04-19T00:00:00Z'),
  createdAt: new Date('2025-04-19T00:00:00Z'),
}

const meta = {
  title: 'Pages/Customers/SubscriptionCard',
  component: SubscriptionCard,
  parameters: {
    layout: 'padded',
    a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
  },
  args: {
    subscription: base,
    now: new Date('2026-09-29T12:00:00Z'),
    formatDate: (value: Date | null) =>
      value
        ? value.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })
        : '—',
    onOpen: fn(),
  },
  render: (args) => (
    <div className="max-w-md">
      <SubscriptionCard {...args} />
    </div>
  ),
} satisfies Meta<typeof SubscriptionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {}
export const Trialing: Story = {
  args: { subscription: { ...base, status: SubscriptionStatus.Trialing } },
}
export const Paused: Story = {
  args: { subscription: { ...base, status: SubscriptionStatus.Paused } },
}

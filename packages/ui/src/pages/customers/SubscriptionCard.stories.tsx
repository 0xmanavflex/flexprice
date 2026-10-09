import type { ComponentProps } from 'react'
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
  title: 'App/Customers/Contract card',
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
  argTypes: {
    subscription: { control: false },
    now: { control: false },
    formatDate: { control: false },
    onOpen: { control: false },
    className: { control: 'text' },
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

const DAY = 86_400_000

type PlaygroundArgs = ComponentProps<typeof SubscriptionCard> & {
  status: SubscriptionStatus
  planName: string
  billingPeriodLabel: string
  elapsedDays: number
  hasPeriod: boolean
}

/** Pick the status and plan, drag the day of the cycle, or drop the period dates. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    status: SubscriptionStatus.Active,
    planName: 'Starter',
    billingPeriodLabel: 'Monthly',
    elapsedDays: 25,
    hasPeriod: true,
  },
  argTypes: {
    status: { control: 'select', options: Object.values(SubscriptionStatus) },
    planName: { control: 'text' },
    billingPeriodLabel: { control: 'select', options: ['Monthly', 'Quarterly', 'Annual'] },
    elapsedDays: { control: { type: 'range', min: 0, max: 30, step: 1 } },
    hasPeriod: { control: 'boolean' },
  },
  render: ({ status, planName, billingPeriodLabel, elapsedDays, hasPeriod, ...args }) => (
    <div className="max-w-md">
      <SubscriptionCard
        {...args}
        subscription={{
          ...base,
          status,
          planName,
          billingPeriodLabel,
          currentPeriodStart: hasPeriod ? base.currentPeriodStart : null,
          currentPeriodEnd: hasPeriod ? base.currentPeriodEnd : null,
        }}
        now={new Date((base.currentPeriodStart as Date).getTime() + elapsedDays * DAY)}
      />
    </div>
  ),
}

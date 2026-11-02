import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SubscriptionRevenue } from './SubscriptionRevenue'
import { ACME_REVENUE } from './subscriptionRevenueFixtures'

const meta = {
  title: 'App/Contracts/Contract revenue',
  component: SubscriptionRevenue,
  args: { revenue: ACME_REVENUE, isLoading: false },
} satisfies Meta<typeof SubscriptionRevenue>

export default meta
type Story = StoryObj<typeof meta>

/** Jan–Feb posted, March half earned and half scheduled, later months scheduled from the annual invoice. */
export const Recognizing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Platform licence')[0]).toBeVisible()
    await expect(canvas.getByText('Full first month')).toBeVisible()
    await expect(canvas.getByText('$1,100.00')).toBeVisible()
    await expect(canvas.getByText('$1,500.00')).toBeVisible()
  },
}

/** No revenue contract for the subscription yet. */
export const NoContract: Story = {
  args: { revenue: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('No revenue contract yet')[0]).toBeVisible()
  },
}

export const Loading: Story = { args: { revenue: undefined, isLoading: true } }

export const Failed: Story = {
  args: { revenue: undefined, error: 'Revenue could not be loaded.' },
}

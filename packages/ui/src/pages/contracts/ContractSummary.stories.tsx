import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PriceType, emptySubscription } from '@fp/domain'
import { makeCharge } from '../product-catalog/plans/planDetailFixtures'
import { ContractSummary } from './ContractSummary'

const CHARGES = [makeCharge(1, { type: PriceType.Fixed }), makeCharge(0, { type: PriceType.Usage })]

const meta = {
  title: 'App/Contracts/Contract summary',
  component: ContractSummary,
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  args: {
    values: {
      ...emptySubscription(),
      customerId: 'cus_1',
      planId: 'plan_1',
      currency: 'USD',
      trialPeriodDays: 14,
    },
    customerLabel: 'Acme Robotics · billing@acme.com',
    planLabel: 'Starter',
    charges: CHARGES,
    today: '2026-10-20',
  },
} satisfies Meta<typeof ContractSummary>

export default meta
type Story = StoryObj<typeof meta>

/** What has been chosen, and the first invoice: the fixed charges, after the trial. */
export const Chosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Acme Robotics')).toBeVisible()
    await expect(canvas.getByText('USD, every month')).toBeVisible()
    await expect(canvas.getByText('$29.00')).toBeVisible()
    await expect(canvas.getByText(/On Nov 3, 2026, after the 14-day trial/)).toBeVisible()
  },
}

/** Before a plan is chosen there is nothing to bill, so the invoice card waits. */
export const NothingChosen: Story = {
  args: { values: emptySubscription(), customerLabel: undefined, planLabel: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('—').length).toBeGreaterThan(0)
    await expect(canvas.queryByText('First invoice')).toBeNull()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { type Plan, PlanStatus } from '@fp/domain'
import { PricingWidget } from './PricingWidget'

const plan = (over: Partial<Plan>): Plan => ({
  id: 'plan_1',
  name: 'Starter',
  lookupKey: 'starter',
  description: 'For small teams.',
  status: PlanStatus.Published,
  chargeCount: 2,
  headline: { amount: '$29', period: 'MONTHLY' },
  createdAt: null,
  updatedAt: null,
  ...over,
})

const meta = {
  title: 'Surfaces/PricingWidget',
  component: PricingWidget,
  parameters: { layout: 'padded' },
  args: {
    plans: [
      plan({}),
      plan({ id: 'plan_2', name: 'Scale', headline: null, chargeCount: 1, description: '' }),
    ],
  },
} satisfies Meta<typeof PricingWidget>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Starter')).toBeInTheDocument()
    await expect(canvas.getByText('$29 /mo')).toBeInTheDocument()
    await expect(canvas.getByText('Usage-based')).toBeInTheDocument()
  },
}

export const Empty: Story = { args: { plans: [] } }
export const Loading: Story = { args: { isLoading: true } }

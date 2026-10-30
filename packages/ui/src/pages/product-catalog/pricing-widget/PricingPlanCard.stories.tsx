import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType } from '@fp/domain'
import { PricingPlanCard } from './PricingPlanCard'

const line = (key: string, label: string, featureName: string, featureType: FeatureType) => ({
  key,
  label,
  featureName,
  featureType,
})

const meta = {
  title: 'App/Product catalog/Pricing widgets/Pricing plan card',
  component: PricingPlanCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  args: {
    name: 'Pay as you go',
    price: '$0',
    per: 'month',
    hasUsage: true,
    included: [
      line('e1', 'Unlimited Image Gen', 'Image Gen', FeatureType.Metered),
      line('e2', 'Unlimited AI message', 'AI message', FeatureType.Metered),
    ],
    credits: [
      {
        key: 'c1',
        amount: '100 credits',
        name: 'Free credits',
        cadence: 'one-time',
        recurring: false,
      },
    ],
    onViewPlan: fn(),
  },
} satisfies Meta<typeof PricingPlanCard>

export default meta
type Story = StoryObj<typeof meta>

/** The widget's card, as V1 shows it. */
export const Widget: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Pay as you go' })).toBeVisible()
    await expect(canvas.getByText('$0')).toBeVisible()
    await expect(canvas.getByText('Included')).toBeVisible()
    await expect(canvas.getByText('100 credits')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'View plan' }))
    await expect(args.onViewPlan).toHaveBeenCalled()
  },
}

/** Each feature's icon, picked by what it counts, as V1 picks it. */
export const FeatureIcons: Story = {
  args: {
    preview: true,
    included: [
      line('a', '5,000 Emails', 'Emails', FeatureType.Metered),
      line('b', '10,000 AI message', 'AI message', FeatureType.Metered),
      line('c', '600 Call minutes', 'Call minutes', FeatureType.Metered),
      line('d', '1,000 API requests', 'API requests', FeatureType.Metered),
      line('e', '20 Seats', 'Seats', FeatureType.Metered),
      line('f', 'SSO', 'SSO', FeatureType.Boolean),
    ],
  },
}

/** The plan preview: usage and "+ Usage", every line, no button. */
export const Preview: Story = {
  args: {
    preview: true,
    price: '$49',
    usage: [
      { key: 'u1', name: 'API calls', price: '$0.01/unit' },
      { key: 'u2', name: 'Storage', price: 'from $0.002/unit' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('+ Usage')).toBeVisible()
    await expect(canvas.getByText('from $0.002/unit')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'View plan' })).toBeNull()
  },
}

/** A recurring grant reads its period after a slash: "2,500 credits · Top-up /monthly". */
export const RecurringCredits: Story = {
  args: {
    credits: [
      {
        key: 'c2',
        amount: '2,500 credits',
        name: 'Top-up',
        cadence: 'monthly',
        recurring: true,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('/monthly', { exact: false })).toBeVisible()
  },
}

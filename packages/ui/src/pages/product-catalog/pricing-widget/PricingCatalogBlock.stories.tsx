import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FeatureType, type PricingCard, type PricingSelection } from '@fp/domain'
import { PricingCatalogBlock, type PricingCatalogBlockProps } from './PricingCatalogBlock'

const inc = (id: string, label: string, featureName: string, featureType: FeatureType) => ({
  id,
  label,
  featureName,
  featureType,
})

const MONTHLY: PricingCard[] = [
  {
    planId: 'plan_payg',
    name: 'Pay as you go',
    description: '',
    price: '$0',
    per: 'month',
    hasUsage: true,
    included: [
      inc('e1', 'Unlimited Image Gen', 'Image Gen', FeatureType.Metered),
      inc('e2', 'Unlimited AI message', 'AI message', FeatureType.Metered),
    ],
    credits: [
      {
        id: 'c1',
        label: '100 credits · Free credits · one-time',
        amount: '100 credits',
        name: 'Free credits',
        cadence: 'one-time',
        recurring: false,
      },
    ],
  },
  {
    planId: 'plan_pro',
    name: 'Pro',
    description: 'For teams shipping to production.',
    price: '$49',
    per: 'month',
    hasUsage: false,
    included: [
      inc('e3', '10,000 AI message', 'AI message', FeatureType.Metered),
      inc('e4', 'SSO', 'SSO', FeatureType.Boolean),
      inc('e5', '5,000 Emails', 'Emails', FeatureType.Metered),
      inc('e6', '1,000 API requests', 'API requests', FeatureType.Metered),
    ],
    credits: [],
  },
  {
    planId: 'plan_metered',
    name: 'Metered',
    description: '',
    price: '$0',
    per: 'month',
    hasUsage: true,
    included: [],
    credits: [
      {
        id: 'c2',
        label: '2,500 credits · Monthly top-up · monthly',
        amount: '2,500 credits',
        name: 'Monthly top-up',
        cadence: 'monthly',
        recurring: true,
      },
    ],
  },
]

const ANNUAL: PricingCard[] = [{ ...MONTHLY[1]!, price: '$490', per: 'year' }]

const PERIODS = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Annual', value: 'ANNUAL' },
]
const CURRENCIES = [
  { label: 'INR', value: 'INR' },
  { label: 'USD', value: 'USD' },
]

/** The picker drives which cards show, as the console page does through `@fp/domain`. */
function Interactive(props: Partial<PricingCatalogBlockProps>) {
  const [selection, setSelection] = useState<PricingSelection>({
    period: 'MONTHLY',
    currency: 'USD',
  })
  const cards = selection.currency !== 'USD' ? [] : selection.period === 'ANNUAL' ? ANNUAL : MONTHLY
  return (
    <PricingCatalogBlock
      cards={cards}
      periods={PERIODS}
      currencies={CURRENCIES}
      selection={selection}
      onSelectionChange={setSelection}
      hasPlans
      onViewPlan={fn()}
      {...props}
    />
  )
}

const meta = {
  title: 'App/Product catalog/Pricing widgets/Pricing widget',
  component: PricingCatalogBlock,
  parameters: { layout: 'fullscreen' },
  args: {
    cards: MONTHLY,
    periods: PERIODS,
    currencies: CURRENCIES,
    selection: { period: 'MONTHLY', currency: 'USD' },
    onSelectionChange: fn(),
    hasPlans: true,
    onViewPlan: fn(),
  },
} satisfies Meta<typeof PricingCatalogBlock>

export default meta
type Story = StoryObj<typeof meta>

/** As V1: a period and currency picker, then V1's card per plan: fee, View plan, Included, Credits. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Pricing widgets', level: 1 })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Pay as you go' })).toBeVisible()
    await expect(canvas.getByText('Unlimited Image Gen')).toBeVisible()
    // The credit line in V1's parts: the amount, the grant, its cadence.
    await expect(canvas.getByText('100 credits')).toBeVisible()
    await expect(canvas.getByText(/Free credits/)).toBeVisible()
    // A plan that only meters usage reads $0 a month, as V1's card does.
    await expect(canvas.getAllByText('$0')).toHaveLength(2)
    // No embed snippet, no info banner, no plan id or status toggles.
    await expect(canvas.queryByText(/embed/i)).toBeNull()
    await expect(canvas.queryByText(/published plan/i)).toBeNull()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await userEvent.click(canvas.getAllByRole('button', { name: 'View plan' })[1]!)
    await expect(args.onViewPlan).toHaveBeenCalledWith('plan_pro')
  },
}

/** Three lines a section, then "+N more", as V1 caps a widget card. */
export const CapsLongLists: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('1,000 API requests')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: '+1 more' }))
    await expect(canvas.getByText('1,000 API requests')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Show less' })).toBeVisible()
  },
}

/** Switching the period or currency changes which plans show and their prices. */
export const SwitchesPeriod: Story = {
  render: () => <Interactive />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$49')).toBeVisible()
    await userEvent.click(canvas.getByRole('combobox', { name: 'Billing period' }))
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Annual' }))
    await expect(await canvas.findByText('$490')).toBeVisible()
    await expect(canvas.queryByText('Pay as you go')).toBeNull()
  },
}

/** Nothing priced in the chosen period and currency: say so, keep the picker. */
export const NothingPricedHere: Story = {
  args: { cards: [], selection: { period: 'MONTHLY', currency: 'INR' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No plans priced here')).toBeVisible()
    await expect(canvas.getByRole('combobox', { name: 'Currency' })).toBeVisible()
  },
}

/** No published plan at all. */
export const NoPlans: Story = {
  args: { cards: [], periods: [], currencies: [], selection: null, hasPlans: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No plans to show yet')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Loading plans')).toBeVisible()
  },
}

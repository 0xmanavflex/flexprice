import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { PricingCard, PricingSelection } from '@fp/domain'
import { PricingCatalogBlock, type PricingCatalogBlockProps } from './PricingCatalogBlock'

const MONTHLY: PricingCard[] = [
  {
    planId: 'plan_payg',
    name: 'Pay as you go',
    description: '',
    price: '$0.00',
    per: 'month',
    hasUsage: true,
    included: [
      { id: 'e1', label: 'Unlimited Image Gen' },
      { id: 'e2', label: 'Unlimited AI message' },
    ],
    credits: [{ id: 'c1', label: '100 credits · Free credits · one-time' }],
  },
  {
    planId: 'plan_pro',
    name: 'Pro',
    description: 'For teams shipping to production.',
    price: '$49.00',
    per: 'month',
    hasUsage: false,
    included: [
      { id: 'e3', label: '10,000 AI message' },
      { id: 'e4', label: 'SSO' },
    ],
    credits: [],
  },
  {
    planId: 'plan_metered',
    name: 'Metered',
    description: '',
    price: null,
    per: 'month',
    hasUsage: true,
    included: [],
    credits: [{ id: 'c2', label: '2,500 credits · Monthly top-up · monthly' }],
  },
]

const ANNUAL: PricingCard[] = [{ ...MONTHLY[1]!, price: '$490.00', per: 'year' }]

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

/** As V1: a period and currency picker, then each plan's fee, what it includes and its credits. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Pricing widget', level: 1 })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Pay as you go' })).toBeVisible()
    await expect(canvas.getByText('Unlimited Image Gen')).toBeVisible()
    await expect(canvas.getByText('100 credits · Free credits · one-time')).toBeVisible()
    // A plan that only meters usage says so instead of showing a price.
    await expect(canvas.getByText('Usage-based')).toBeVisible()
    // No embed snippet, no info banner, no plan id or status toggles.
    await expect(canvas.queryByText(/embed/i)).toBeNull()
    await expect(canvas.queryByText(/published plan/i)).toBeNull()
    await expect(canvas.queryByRole('switch')).toBeNull()
    await userEvent.click(canvas.getAllByRole('button', { name: 'View plan' })[1]!)
    await expect(args.onViewPlan).toHaveBeenCalledWith('plan_pro')
  },
}

/** Switching the period or currency changes which plans show and their prices. */
export const SwitchesPeriod: Story = {
  render: () => <Interactive />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$49.00')).toBeVisible()
    await userEvent.click(canvas.getByRole('combobox', { name: 'Billing period' }))
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Annual' }))
    await expect(await canvas.findByText('$490.00')).toBeVisible()
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

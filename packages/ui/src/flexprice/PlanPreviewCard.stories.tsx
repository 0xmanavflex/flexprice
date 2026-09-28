import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  InvoiceCadence,
  PriceType,
  TierMode,
} from '@fp/domain'
import { PlanPreviewCard } from './PlanPreviewCard'

/**
 * The live pricing preview. Fixtures in, a customer's-eye pricing card out —
 * headline, what the plan carries, and an example bill computed from the drafts.
 * No provider, no network.
 */
const meta = {
  title: 'Surfaces/PlanPreviewCard',
  component: PlanPreviewCard,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PlanPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

const base: CreateCharge = {
  type: PriceType.Fixed,
  billingModel: BillingModel.FlatFee,
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly,
  invoiceCadence: InvoiceCadence.Advance,
  amount: '29',
  displayName: 'Platform base',
}

const tieredUsage: CreateCharge = {
  type: PriceType.Usage,
  billingModel: BillingModel.Tiered,
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly,
  invoiceCadence: InvoiceCadence.Arrear,
  meterId: 'meter_api',
  tierMode: TierMode.Volume,
  tiers: [
    { upTo: 10_000, unitAmount: '0.002', flatAmount: '0' },
    { upTo: null, unitAmount: '0.001' },
  ],
}

const packageUsage: CreateCharge = {
  type: PriceType.Usage,
  billingModel: BillingModel.Package,
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly,
  invoiceCadence: InvoiceCadence.Arrear,
  meterId: 'meter_tokens',
  amount: '2',
  divideBy: 1000,
  displayName: 'Tokens',
}

export const Empty: Story = {
  args: { name: 'Starter', charges: [] },
}

export const FixedOnly: Story = {
  args: { name: 'Starter', charges: [base] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Example bill')).toBeInTheDocument()
  },
}

export const FixedAndUsage: Story = {
  args: {
    name: 'Growth',
    charges: [base, tieredUsage, packageUsage],
    meterLabel: (id) => (id === 'meter_api' ? 'API calls' : 'Tokens'),
  },
}

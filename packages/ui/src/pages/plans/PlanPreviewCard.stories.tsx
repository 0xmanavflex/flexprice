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
import { CreditGrantCadence, CreditGrantPeriod, FeatureType } from '@fp/domain'
import { PlanPreviewCard, creditLine, includedLine } from './PlanPreviewCard'

/**
 * The live pricing preview. Fixtures in, a customer's-eye pricing card out —
 * headline price, usage, included entitlements and credits, all from staged data.
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
    await expect(within(canvasElement).getByText('What customers see')).toBeInTheDocument()
  },
}

export const FixedAndUsage: Story = {
  args: {
    name: 'Growth',
    charges: [base, tieredUsage, packageUsage],
    meterLabel: (id) => (id === 'meter_api' ? 'API calls' : 'Tokens'),
  },
}

export const FullPlan: Story = {
  args: {
    name: 'Starter',
    trialDays: 14,
    charges: [base, tieredUsage, packageUsage],
    meterLabel: (id) => (id === 'meter_api' ? 'API calls' : 'Tokens'),
    included: [
      includedLine({
        key: 'a',
        name: 'AI Tokens',
        featureType: FeatureType.Metered,
        usageLimit: 10_000,
      }),
      includedLine({
        key: 'b',
        name: 'Video Minutes',
        featureType: FeatureType.Metered,
        usageLimit: 50_000,
      }),
      includedLine({
        key: 'c',
        name: 'Compute Minutes',
        featureType: FeatureType.Metered,
        usageLimit: null,
      }),
      includedLine({ key: 'd', name: 'SSO', featureType: FeatureType.Boolean, isEnabled: true }),
    ],
    credits: [
      creditLine({ key: 'g1', name: 'Welcome credits', credits: 5000, cadence: 'ONETIME' }),
      creditLine({
        key: 'g2',
        name: 'Monthly included credits',
        credits: 2000,
        cadence: 'RECURRING',
        period: 'MONTHLY',
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    await expect(c.getByText('14-day free trial · plus usage')).toBeInTheDocument()
    await expect(c.getByText('and 1 more')).toBeInTheDocument()
  },
}

/** Units read as words, and recurring credits as a rate, as in the redesign. */
export const ReadsLikeTheRedesign: Story = {
  args: {
    name: 'Starter',
    trialDays: 14,
    charges: [base, tieredUsage],
    meterLabel: () => 'API Calls',
    meterUnit: () => 'call',
    included: [
      includedLine({
        key: 'tokens',
        name: 'AI Tokens',
        unit: 'tokens',
        featureType: FeatureType.Metered,
        usageLimit: 10_000,
      }),
    ],
    credits: [
      creditLine({
        key: 'monthly',
        name: 'Monthly included credits',
        credits: 2000,
        cadence: CreditGrantCadence.Recurring,
        period: CreditGrantPeriod.Monthly,
      }),
    ],
  },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement)
    await expect(card.getByText('2 tiers, from $0.002 per call')).toBeInTheDocument()
    await expect(card.getByText('10K tokens')).toBeInTheDocument()
    await expect(card.getByText('2,000 / mo')).toBeInTheDocument()
  },
}

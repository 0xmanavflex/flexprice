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
 * The live pricing preview. Fixtures in, a customer's-eye pricing card out:
 * headline price, usage, included entitlements and credits, all from staged data.
 * No provider, no network.
 */
const meta = {
  title: 'App/Product catalog/Plans/Plan preview card',
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
  args: { charges: [] },
}

export const FixedOnly: Story = {
  args: { charges: [base] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('What customers see')).toBeInTheDocument()
  },
}

export const FixedAndUsage: Story = {
  args: {
    charges: [base, tieredUsage, packageUsage],
    meterLabel: (id) => (id === 'meter_api' ? 'API calls' : 'Tokens'),
  },
}

/** Usage only: no blank flat price and no "plus usage". The headline is the plan type. */
export const UsageOnly: Story = {
  args: {
    charges: [tieredUsage, packageUsage],
    meterLabel: (id) => (id === 'meter_api' ? 'API calls' : 'Tokens'),
    trialDays: 14,
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement)
    await expect(c.getByText('Usage-based')).toBeVisible()
    await expect(c.getByText('Billed on what is used')).toBeVisible()
    await expect(c.queryByText(/plus usage/i)).toBeNull()
    await expect(c.getByText('14-day free trial')).toBeVisible()
  },
}

export const FullPlan: Story = {
  args: {
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
    await expect(c.getByText('Plus usage')).toBeInTheDocument()
    await expect(c.getByText('14-day free trial')).toBeInTheDocument()
    await expect(c.getByText('Unlimited Compute Minutes')).toBeInTheDocument()
    await expect(c.getByText('SSO')).toBeInTheDocument()
  },
}

/** Units read as words, and recurring credits as a rate, as in the redesign. */
export const ReadsLikeTheRedesign: Story = {
  args: {
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
    await expect(card.getByText('Plus usage')).toBeInTheDocument()
    await expect(card.getByText('10,000 AI Tokens')).toBeInTheDocument()
    await expect(card.getByText('2,000 credits · Monthly included credits · monthly')).toBeInTheDocument()
  },
}

const INCLUDED_POOL = [
  { name: 'AI Tokens', featureType: FeatureType.Metered, usageLimit: 10_000 },
  { name: 'Video Minutes', featureType: FeatureType.Metered, usageLimit: 50_000 },
  { name: 'Compute Minutes', featureType: FeatureType.Metered, usageLimit: null },
  { name: 'SSO', featureType: FeatureType.Boolean, isEnabled: true },
  { name: 'Audit log', featureType: FeatureType.Boolean, isEnabled: true },
  { name: 'Priority support', featureType: FeatureType.Boolean, isEnabled: false },
] as const

interface PlaygroundArgs {
  /** The base fee; 0 leaves it out, and with no usage the card shows its empty prompt. */
  fixedAmount: number
  currency: string
  billingPeriod: BillingPeriod
  usage: 'none' | 'tiered' | 'package'
  /** 0 hides the trial line. */
  trialDays: number
  includedCount: number
  creditCount: number
  recurringCredits: boolean
}

/** Every line of the customer-facing card is driven from these controls. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    fixedAmount: 29,
    currency: 'USD',
    billingPeriod: BillingPeriod.Monthly,
    usage: 'tiered',
    trialDays: 14,
    includedCount: 3,
    creditCount: 2,
    recurringCredits: true,
  },
  argTypes: {
    fixedAmount: { control: { type: 'number', min: 0, max: 10_000, step: 1 } },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'INR'] },
    billingPeriod: { control: 'select', options: Object.values(BillingPeriod) },
    usage: { control: 'inline-radio', options: ['none', 'tiered', 'package'] },
    trialDays: { control: { type: 'number', min: 0, max: 90, step: 1 } },
    includedCount: { control: { type: 'number', min: 0, max: INCLUDED_POOL.length, step: 1 } },
    creditCount: { control: { type: 'number', min: 0, max: 4, step: 1 } },
    recurringCredits: { control: 'boolean' },
  },
  render: ({
    fixedAmount,
    currency,
    billingPeriod,
    usage,
    trialDays,
    includedCount,
    creditCount,
    recurringCredits,
  }) => {
    const charges: CreateCharge[] = [
      ...(fixedAmount > 0
        ? [{ ...base, amount: String(fixedAmount), currency, billingPeriod }]
        : []),
      ...(usage === 'tiered' ? [{ ...tieredUsage, currency }] : []),
      ...(usage === 'package' ? [{ ...packageUsage, currency }] : []),
    ]
    return (
      <PlanPreviewCard
        charges={charges}
        trialDays={trialDays}
        meterLabel={(id) => (id === 'meter_api' ? 'API calls' : 'Tokens')}
        included={INCLUDED_POOL.slice(0, includedCount).map((item, index) =>
          includedLine({ key: `inc_${index}`, ...item }),
        )}
        credits={Array.from({ length: creditCount }, (_, index) =>
          creditLine({
            key: `credit_${index}`,
            name: `Credit grant ${index + 1}`,
            credits: 1000 * (index + 1),
            cadence: recurringCredits ? CreditGrantCadence.Recurring : CreditGrantCadence.OneTime,
            period: recurringCredits ? CreditGrantPeriod.Monthly : null,
          }),
        )}
        locale="en-US"
      />
    )
  },
}

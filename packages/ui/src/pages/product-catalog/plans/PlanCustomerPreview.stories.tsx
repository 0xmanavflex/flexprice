import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { BillingModel, BillingPeriod, FeatureType } from '@fp/domain'
import { PlanCustomerPreview } from './PlanCustomerPreview'
import { makeCharges, makeEntitlements, makeGrants, meterUnitOf } from './planDetailFixtures'

interface PlaygroundProps {
  fixedCharges: number
  usageCharges: number
  usageModel: BillingModel
  billingPeriod: BillingPeriod
  entitlements: number
  entitlementType: FeatureType | 'mixed'
  creditGrants: number
  /** 0 means no trial. */
  trialDays: number
  /** Pass unit resolvers, so wording reads "per call" and "tokens". */
  withUnits: boolean
}

/** The saved plan's charges, entitlements and grants are built from counts and fed to the real adapter. */
function PreviewPlayground({
  fixedCharges,
  usageCharges,
  usageModel,
  billingPeriod,
  entitlements,
  entitlementType,
  creditGrants,
  trialDays,
  withUnits,
}: PlaygroundProps) {
  return (
    <div className="w-[360px]">
      <PlanCustomerPreview
        charges={makeCharges(fixedCharges, usageCharges, {
          billingModel: usageModel,
          billingPeriod,
        })}
        entitlements={makeEntitlements(entitlements, { featureType: entitlementType })}
        grants={makeGrants(creditGrants)}
        trialDays={trialDays > 0 ? trialDays : null}
        {...(withUnits ? { meterUnit: meterUnitOf, featureUnit: () => 'units' } : {})}
      />
    </div>
  )
}

/** What customers see for a saved plan: the shared pricing card, driven by counts of charges, entitlements and grants. */
const meta = {
  title: 'Surfaces/PlanCustomerPreview',
  component: PreviewPlayground,
  parameters: { layout: 'centered' },
  args: {
    fixedCharges: 1,
    usageCharges: 1,
    usageModel: BillingModel.Tiered,
    billingPeriod: BillingPeriod.Monthly,
    entitlements: 3,
    entitlementType: 'mixed',
    creditGrants: 1,
    trialDays: 14,
    withUnits: true,
  },
  argTypes: {
    fixedCharges: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    usageCharges: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    usageModel: { control: 'select', options: Object.values(BillingModel) },
    billingPeriod: { control: 'select', options: Object.values(BillingPeriod) },
    entitlements: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    entitlementType: { control: 'select', options: ['mixed', ...Object.values(FeatureType)] },
    creditGrants: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    trialDays: { control: { type: 'number', min: 0, max: 90, step: 1 } },
    withUnits: { control: 'boolean' },
  },
} satisfies Meta<typeof PreviewPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('What customers see')).toBeInTheDocument()
  },
}

/** A plan that prices nothing yet. */
export const Empty: Story = {
  args: {
    fixedCharges: 0,
    usageCharges: 0,
    entitlements: 0,
    creditGrants: 0,
    trialDays: 0,
  },
}

export const FixedOnly: Story = {
  args: { usageCharges: 0, entitlements: 0, creditGrants: 0, trialDays: 0 },
}

export const UsageOnly: Story = {
  args: { fixedCharges: 0, entitlements: 2, creditGrants: 0, trialDays: 0 },
}

/** Long lists collapse behind "and N more" rather than growing the card. */
export const LongLists: Story = {
  args: { fixedCharges: 3, usageCharges: 4, entitlements: 20, creditGrants: 6 },
}

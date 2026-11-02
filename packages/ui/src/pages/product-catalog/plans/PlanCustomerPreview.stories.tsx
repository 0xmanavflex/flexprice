import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { BillingModel, BillingPeriod, FeatureType } from '@fp/domain'
import { PlanCustomerPreview } from './PlanCustomerPreview'
import { makeCharges, makeEntitlements, makeGrants } from './planDetailFixtures'

interface PlaygroundProps {
  fixedCharges: number
  usageCharges: number
  usageModel: BillingModel
  billingPeriod: BillingPeriod
  entitlements: number
  entitlementType: FeatureType | 'mixed'
  creditGrants: number
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
}: PlaygroundProps) {
  return (
    <div className="w-[360px]">
      <PlanCustomerPreview
        plan={{ id: 'plan_story', name: 'Pay as you go', description: '' }}
        charges={makeCharges(fixedCharges, usageCharges, {
          billingModel: usageModel,
          billingPeriod,
        })}
        entitlements={makeEntitlements(entitlements, { featureType: entitlementType })}
        grants={makeGrants(creditGrants)}
      />
    </div>
  )
}

/** What customers see for a saved plan: V1's pricing card in preview mode, driven by counts of charges, entitlements and grants. */
const meta = {
  title: 'App/Product catalog/Plans/Plan customer preview',
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
  },
  argTypes: {
    fixedCharges: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    usageCharges: { control: { type: 'number', min: 0, max: 10, step: 1 } },
    usageModel: { control: 'select', options: Object.values(BillingModel) },
    billingPeriod: { control: 'select', options: Object.values(BillingPeriod) },
    entitlements: { control: { type: 'number', min: 0, max: 30, step: 1 } },
    entitlementType: { control: 'select', options: ['mixed', ...Object.values(FeatureType)] },
    creditGrants: { control: { type: 'number', min: 0, max: 10, step: 1 } },
  },
} satisfies Meta<typeof PreviewPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('What customers see')).toBeInTheDocument()
    // V1's card: the plan's name, then the price and its period.
    await expect(canvas.getByRole('heading', { name: 'Pay as you go' })).toBeVisible()
    await expect(canvas.getByText('/month', { exact: false })).toBeVisible()
    // A preview lists usage and has no View plan.
    await expect(canvas.getByRole('link', { name: 'Usage' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'View plan' })).toBeNull()
  },
}

/** A plan that prices nothing yet. */
export const Empty: Story = {
  args: {
    fixedCharges: 0,
    usageCharges: 0,
    entitlements: 0,
    creditGrants: 0,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Add a charge and the price customers see builds up here.'),
    ).toBeVisible()
  },
}

export const FixedOnly: Story = {
  args: { usageCharges: 0, entitlements: 0, creditGrants: 0 },
}

export const UsageOnly: Story = {
  args: { fixedCharges: 0, entitlements: 2, creditGrants: 0 },
}

/** A preview lists every line, as V1's preview does. */
export const LongLists: Story = {
  args: { fixedCharges: 3, usageCharges: 4, entitlements: 20, creditGrants: 6 },
}

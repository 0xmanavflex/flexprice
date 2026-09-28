import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  InvoiceCadence,
  PriceType,
  PriceEntityType,
  TierMode,
} from '@fp/domain'
import { ChargeEditor } from './ChargeEditor'

/**
 * The standalone, stepped charge builder: pick a charge type, configure it with
 * the charge form, then review the working set and save. No inline preview — that
 * lives on the plan detail page now. Fixtures in, a validated `CreateCharge[]` out
 * on save — no provider, no network.
 */
const meta = {
  title: 'Surfaces/ChargeEditor',
  component: ChargeEditor,
  parameters: {
    layout: 'fullscreen',
    // The vendored ReUI Stepper renders role="tablist" without role="tab"
    // children (its steps are buttons), which axe flags as aria-required-children
    // — an upstream ARIA shape we do not fork. Disable just that rule.
    a11y: { config: { rules: [{ id: 'aria-required-children', enabled: false }] } },
  },
  args: {
    planName: 'Growth',
    entityType: PriceEntityType.Plan,
    onSave: fn(),
    onCancel: fn(),
    meters: [
      { id: 'meter_api', name: 'API calls' },
      { id: 'meter_tokens', name: 'Tokens processed' },
    ],
  },
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChargeEditor>

export default meta
type Story = StoryObj<typeof meta>

const fixedBase: CreateCharge = {
  type: PriceType.Fixed,
  billingModel: BillingModel.FlatFee,
  currency: 'USD',
  billingPeriod: BillingPeriod.Monthly,
  invoiceCadence: InvoiceCadence.Advance,
  amount: '29',
  displayName: 'Platform base',
}

const usageTiered: CreateCharge = {
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

/** The first-run state: the type step, choose a charge type to begin. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /fixed charge/i })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /usage charge/i })).toBeInTheDocument()
  },
}

/** A plan already carrying a fixed base and a tiered usage charge lands on Review. */
export const WithCharges: Story = {
  args: { initialCharges: [fixedBase, usageTiered] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The review lists each charge by its name; the tiered usage charge resolves
    // to its meter, "API calls".
    await expect(canvas.getByText('Platform base')).toBeInTheDocument()
    await expect(canvas.getByText('API calls')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /save charges/i })).toBeInTheDocument()
  },
}

/** Picking a type and continuing opens the charge form to configure it. */
export const AddingAFixedCharge: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /fixed charge/i }))
    await userEvent.click(canvas.getByRole('button', { name: /continue/i }))
    await expect(await canvas.findByText('New charge')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /^add charge$/i })).toBeInTheDocument()
  },
}

export const Saving: Story = {
  args: { initialCharges: [fixedBase], isSaving: true },
}

export const SaveError: Story = {
  args: {
    initialCharges: [fixedBase],
    saveError: 'One of the charges was rejected. Check the amounts and try again.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

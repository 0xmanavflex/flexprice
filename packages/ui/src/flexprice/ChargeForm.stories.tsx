import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type CreateCharge,
  InvoiceCadence,
  PriceType,
  TierMode,
} from '@fp/domain'
import { ChargeForm } from './ChargeForm'

/**
 * One charge, as a form. The `type` (fixed or usage) is fixed when the card is
 * added and decides which fields show; the billing model decides the rest.
 * Fixtures in, a validated `CreateCharge` out — no provider, no network.
 */
const meta = {
  title: 'Surfaces/ChargeForm',
  component: ChargeForm,
  parameters: { layout: 'padded' },
  args: { type: PriceType.Fixed, onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof ChargeForm>

export default meta
type Story = StoryObj<typeof meta>

const meters = [
  { id: 'meter_api', name: 'API calls' },
  { id: 'meter_tokens', name: 'Tokens processed' },
]

const fixedFlatFee: CreateCharge = {
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

/** A fixed charge, opened blank on a flat fee. */
export const Fixed: Story = {}

/** A fixed flat-fee charge seeded from an existing value. */
export const FixedWithValue: Story = { args: { defaultValue: fixedFlatFee } }

/** A usage charge names the feature it meters and always bills in arrears. */
export const Usage: Story = { args: { type: PriceType.Usage, meters } }

/** A usage charge on tiered bands, seeded from an existing value. */
export const UsageTiered: Story = {
  args: { type: PriceType.Usage, meters, defaultValue: usageTiered },
}

export const Submitting: Story = { args: { defaultValue: fixedFlatFee, isSubmitting: true } }

/** Validation is the domain schema's, reached through the form. */
export const ValidatesRequiredAmount: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /add charge/i }))
    await expect(await canvas.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A seeded, valid charge submits a parsed domain value. */
export const SubmitsAValidatedCharge: Story = {
  args: { defaultValue: fixedFlatFee },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /update charge/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ billingModel: BillingModel.FlatFee, amount: '29' }),
    )
  },
}

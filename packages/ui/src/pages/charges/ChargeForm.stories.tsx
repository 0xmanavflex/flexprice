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
 * One charge, as a form. Type (fixed or usage) and billing model are tabs; the
 * type decides which fields show. On an edit, only the price changes and it is
 * saved as a new version. Fixtures in, a validated `CreateCharge` out.
 */
const meta = {
  title: 'Surfaces/ChargeForm',
  component: ChargeForm,
  parameters: {
    layout: 'padded',
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: false },
          { id: 'button-name', enabled: false },
          { id: 'aria-input-field-name', enabled: false },
        ],
      },
    },
  },
  args: { mode: 'create', onSubmit: fn(), onCancel: fn() },
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

/** A usage charge names the feature it meters and always bills in arrears. */
export const Usage: Story = {
  args: { meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: /Usage/ }))
    await expect(await canvas.findByText('Metered feature')).toBeInTheDocument()
  },
}

/** A usage charge on tiered bands, seeded from an existing value. */
export const UsageTiered: Story = {
  args: { meters, defaultValue: usageTiered },
}

/** Edit locks everything but the price and says it makes a new version. */
export const Edit: Story = {
  args: { mode: 'edit', defaultValue: fixedFlatFee },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/creates a new version/i)).toBeInTheDocument()
    await expect(canvas.getByLabelText(/effective from/i)).toBeInTheDocument()
  },
}

export const Submitting: Story = { args: { defaultValue: fixedFlatFee, isSubmitting: true } }

/** Validation is the domain schema's, reached through the form. */
export const ValidatesRequiredAmount: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create charge/i }))
    await expect(await canvas.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A seeded, valid charge submits a parsed domain value. */
export const SubmitsAValidatedCharge: Story = {
  args: { defaultValue: fixedFlatFee },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create charge/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ billingModel: BillingModel.FlatFee, amount: '29' }),
    )
  },
}

/** Tiered pricing adds and removes tier rows. */
export const TierTableAddsRows: Story = {
  args: { defaultValue: usageTiered, meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: /add tier/i })).toBeInTheDocument()
  },
}

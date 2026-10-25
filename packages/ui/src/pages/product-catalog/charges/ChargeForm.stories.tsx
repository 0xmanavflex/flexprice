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
  title: 'App/Product catalog/Charges/Charge form',
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
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    lockType: { control: 'boolean' },
    submitLabel: { control: 'text' },
    currencies: { control: 'object' },
    defaultValue: { control: false },
    meters: { control: false },
    priceUnits: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof ChargeForm>

export default meta
type Story = StoryObj<typeof meta>

/*
 * The aggregation and the meter's own window are what decide whether a usage
 * window may be set on the charge, so the fixtures cover all three answers the
 * API gives: a windowable meter, one that already buckets itself, and one
 * whose aggregation cannot be windowed.
 */
const meters = [
  { id: 'meter_api', name: 'API calls', aggregationType: 'SUM' },
  { id: 'meter_tokens', name: 'Tokens processed', aggregationType: 'MAX' },
  { id: 'meter_seats', name: 'Peak seats', aggregationType: 'MAX', bucketSize: 'DAY' },
  { id: 'meter_events', name: 'Events counted', aggregationType: 'COUNT' },
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

/** Flip create/edit, submitting, a server error and the locked type from the controls. */
export const Playground: Story = {
  args: { meters, isSubmitting: false, submitError: '', lockType: false },
  render: ({ mode, submitError, ...args }) => (
    <ChargeForm
      key={`${mode}-${args.lockType}`}
      {...args}
      mode={mode}
      submitError={submitError || null}
      {...(mode === 'edit' ? { defaultValue: fixedFlatFee } : {})}
    />
  ),
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

/** In the catalogue, a fixed charge can join a price group and set a minimum quantity. */
export const SetsPriceOptions: Story = {
  args: {
    defaultValue: fixedFlatFee,
    priceOptions: { groups: [{ value: 'grp_1', label: 'Seats' }] },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText(/^tag/i)).toBeInTheDocument()
    await expect(canvas.getByLabelText(/^start date/i)).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText(/^minimum quantity/i), '3')
    await userEvent.click(canvas.getByRole('button', { name: /create charge/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ minQuantity: 3 }))
  },
}

/** Without the catalogue's options: on a contract: those fields stay out. */
export const HidesPriceOptionsOutsideTheCatalogue: Story = {
  args: { defaultValue: fixedFlatFee },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByLabelText(/^minimum quantity/i)).toBeNull()
    await expect(canvas.queryByLabelText(/^start date/i)).toBeNull()
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

/**
 * A windowable meter offers the window; the charge prices each window rather
 * than one figure for the whole period.
 */
export const UsageWindowOffered: Story = {
  args: { defaultValue: usageTiered, meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Usage window')).toBeVisible()
  },
}

/**
 * A meter bucketed at the meter level will not take a second window.
 *
 * The API refuses it rather than deciding which wins, so the field shows the
 * meter's own value, locked, and says where it comes from: hiding it would
 * leave someone hunting for a setting that is already made.
 */
export const UsageWindowOwnedByTheMeter: Story = {
  args: { defaultValue: { ...usageTiered, meterId: 'meter_seats' }, meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Usage window')).toBeVisible()
    await expect(canvas.getByText(/Set on the Peak seats feature itself/)).toBeVisible()
  },
}

/**
 * COUNT cannot be windowed: re-counting the same events in smaller pieces
 * sums to the same number: so the field is not offered at all.
 */
export const UsageWindowNotWindowable: Story = {
  args: { defaultValue: { ...usageTiered, meterId: 'meter_events' }, meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Usage window')).toBeNull()
  },
}

/** A fixed charge has no meter to window, so the field never appears. */
export const UsageWindowHiddenOnFixed: Story = {
  args: { defaultValue: fixedFlatFee, meters },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('Usage window')).toBeNull()
  },
}

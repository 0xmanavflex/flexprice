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
 * The two-pane charges builder. Charge cards on the left, a sticky live preview
 * on the right that updates as charges are added, edited or removed. Fixtures
 * in, a validated `CreateCharge[]` out on save — no provider, no network.
 */
const meta = {
  title: 'Surfaces/ChargeEditor',
  component: ChargeEditor,
  parameters: { layout: 'fullscreen' },
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

/** The first-run state: choose a charge type to begin. */
export const Empty: Story = {}

/** A plan already carrying a fixed base and a tiered usage charge. */
export const WithCharges: Story = {
  args: { initialCharges: [fixedBase, usageTiered] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // "Platform base" shows on both the charge card and the preview line item.
    await expect(canvas.getAllByText('Platform base').length).toBeGreaterThan(0)
    await expect(canvas.getByText('Example bill')).toBeInTheDocument()
  },
}

/** Adding a fixed charge opens its form in place. */
export const AddingAFixedCharge: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /add fixed charge/i }))
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

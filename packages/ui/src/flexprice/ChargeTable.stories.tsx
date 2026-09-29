import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type Charge,
  InvoiceCadence,
  PriceEntityType,
  PriceType,
  RoundType,
  TierMode,
} from '@fp/domain'
import { ChargeTable } from './ChargeTable'

/**
 * A plan's charges, as a read table. Charge type and timing read together —
 * "Recurring · Advance/Arrears" for a fixed charge, "Usage-based" for a metered
 * one. Presentational: `Charge[]` in, intent reported out. No network.
 */
const meta = {
  title: 'Surfaces/ChargeTable',
  component: ChargeTable,
  parameters: { layout: 'padded' },
  args: { charges: [], locale: 'en-US' },
} satisfies Meta<typeof ChargeTable>

export default meta
type Story = StoryObj<typeof meta>

const chargeFixtures: Charge[] = [
  {
    id: 'price_01',
    type: PriceType.Fixed,
    billingModel: BillingModel.FlatFee,
    amount: '29.00',
    displayAmount: '$29.00',
    currency: 'usd',
    billingPeriod: BillingPeriod.Monthly,
    billingPeriodCount: 1,
    invoiceCadence: InvoiceCadence.Advance,
    billingCadence: 'RECURRING',
    tierMode: null,
    tiers: [],
    transformQuantity: null,
    meterId: null,
    meterName: null,
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: 'platform_base',
    description: '',
    displayName: 'Platform base',
    createdAt: new Date('2026-01-10T00:00:00Z'),
  },
  {
    id: 'price_02',
    type: PriceType.Usage,
    billingModel: BillingModel.Tiered,
    amount: '',
    displayAmount: '',
    currency: 'usd',
    billingPeriod: BillingPeriod.Monthly,
    billingPeriodCount: 1,
    invoiceCadence: InvoiceCadence.Arrear,
    billingCadence: 'RECURRING',
    tierMode: TierMode.Volume,
    tiers: [
      { upTo: 10_000, unitAmount: '0.002', flatAmount: '0' },
      { upTo: null, unitAmount: '0.001' },
    ],
    transformQuantity: null,
    meterId: 'meter_api',
    meterName: 'API calls',
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: '',
    description: '',
    displayName: '',
    createdAt: new Date('2026-01-12T00:00:00Z'),
  },
  {
    id: 'price_03',
    type: PriceType.Fixed,
    billingModel: BillingModel.Package,
    amount: '2.00',
    displayAmount: '$2.00',
    currency: 'usd',
    billingPeriod: BillingPeriod.Monthly,
    billingPeriodCount: 1,
    invoiceCadence: InvoiceCadence.Arrear,
    billingCadence: 'RECURRING',
    tierMode: null,
    tiers: [],
    transformQuantity: { divideBy: 1000, round: RoundType.Up },
    meterId: null,
    meterName: null,
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: '',
    description: '',
    displayName: 'Included storage',
    createdAt: new Date('2026-01-14T00:00:00Z'),
  },
]

/** The read-only table the Overview tab shows. */
export const Default: Story = {
  args: { charges: chargeFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Platform base')).toBeInTheDocument()
    await expect(canvas.getByText('Usage-based')).toBeInTheDocument()
    await expect(canvas.getByText('2 tiers · Volume')).toBeInTheDocument()
    await expect(canvas.getAllByText('Recurring').length).toBeGreaterThan(0)
  },
}

/** With add and terminate wired, each row carries a terminate action. */
export const WithActions: Story = {
  args: { charges: chargeFixtures, onAdd: fn(), onTerminate: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /terminate platform base/i }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /add charges/i })).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { charges: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No charges yet')).toBeInTheDocument()
    // With an add flow wired, the copy may ask for a charge.
    await expect(canvas.getByText(/add a fixed base or a usage charge/i)).toBeInTheDocument()
  },
}

/**
 * Empty on a surface with no add flow — the add-on page.
 *
 * The instruction is dropped with the action: telling someone to add a charge
 * on a surface that offers no way to do it is worse than saying nothing.
 */
export const EmptyWithoutAddAction: Story = {
  args: { charges: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No charges yet')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /add charges/i })).not.toBeInTheDocument()
    await expect(canvas.queryByText(/add a fixed base or a usage charge/i)).not.toBeInTheDocument()
  },
}

/**
 * The caller names its own entity.
 *
 * This table is shared by plans, add-ons and cost sheets, so it must not say
 * "A plan" — which is what the add-on page used to show, verbatim.
 */
export const EmptyWithCallerCopy: Story = {
  args: { charges: [], emptyDescription: 'This add-on bills nothing until it has a charge.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText('This add-on bills nothing until it has a charge.'),
    ).toBeInTheDocument()
    await expect(canvas.queryByText(/a plan bills nothing/i)).not.toBeInTheDocument()
  },
}

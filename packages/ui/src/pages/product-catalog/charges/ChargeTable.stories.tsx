import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
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
 * A charges section: a flush `Section` with the charge (fixed or usage dot),
 * billing model, how it is billed and its price. Presentational: `Charge[]` in,
 * intent reported out. No network.
 */
const meta = {
  title: 'App/Product catalog/Charges/Charge table',
  component: ChargeTable,
  parameters: { layout: 'padded' },
  args: { charges: [], locale: 'en-US' },
  argTypes: {
    charges: { control: false },
    title: { control: 'text' },
    emptyDescription: { control: 'text' },
    locale: { control: 'select', options: ['en-US', 'en-GB', 'de-DE'] },
    onAdd: { control: false },
    onEdit: { control: false },
    onTerminate: { control: false },
  },
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
    bucketSize: null,
    meterId: null,
    meterName: null,
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: 'platform_base',
    description: '',
    displayName: 'Platform base',
    startDate: null,
    endDate: null,
    sequence: 1,
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
    bucketSize: null,
    meterId: 'meter_api',
    meterName: 'API calls',
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: '',
    description: '',
    displayName: '',
    startDate: null,
    endDate: null,
    sequence: 1,
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
    bucketSize: null,
    meterId: null,
    meterName: null,
    entityType: PriceEntityType.Plan,
    entityId: 'plan_01',
    lookupKey: '',
    description: '',
    displayName: 'Included storage',
    startDate: null,
    endDate: null,
    sequence: 1,
    createdAt: new Date('2026-01-14T00:00:00Z'),
  },
]

function manyCharges(count: number): Charge[] {
  return Array.from({ length: count }, (_, index) => {
    const base = chargeFixtures[index % chargeFixtures.length] as Charge
    return {
      ...base,
      id: `price_gen_${index}`,
      displayName: base.displayName ? `${base.displayName} ${index + 1}` : '',
    }
  })
}

/** Drag `rows` from 0 to 60: empty state, a short list, a long one. Toggle the row actions. */
export const Playground: StoryObj<
  ComponentProps<typeof ChargeTable> & { rows: number; showActions: boolean }
> = {
  args: { rows: 6, showActions: true, title: 'Charges' },
  argTypes: {
    rows: { control: { type: 'range', min: 0, max: 60, step: 1 } },
    showActions: { control: 'boolean' },
  },
  render: ({ rows, showActions, ...args }) => (
    <ChargeTable
      {...args}
      charges={manyCharges(rows)}
      {...(showActions ? { onAdd: fn(), onEdit: fn(), onTerminate: fn() } : {})}
    />
  ),
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
}

/**
 * The charges section an add-on shows.
 *
 * Two columns and a grey line, not four columns: the billing model moved under
 * the name, the tier count under the price. A charge with no flags is a charge
 * with nothing unusual about it, which is most of them.
 */
export const Default: Story = {
  args: { charges: chargeFixtures },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Platform base')).toBeInTheDocument()
    await expect(canvas.getByText('API calls')).toBeInTheDocument()
    // The model is the grey line under the name now.
    await expect(canvas.getByText('Fixed · Flat fee')).toBeInTheDocument()
    await expect(canvas.getByText('Usage · Volume tiered')).toBeInTheDocument()
    await expect(canvas.getByText('2 tiers')).toBeInTheDocument()
    // Nothing is flagged, so no chip is offered.
    await expect(canvas.queryByRole('button', { name: /Price changed/ })).not.toBeInTheDocument()
  },
}

/**
 * The five flags, and what a click on one is for.
 *
 * The chips carry no values: never "20% off": because a value on a chip is a
 * value read instead of the sheet, and five of them put the nested table back.
 * Each chip opens the sheet at its own part; the row opens it at the top.
 */
export const Flagged: Story = {
  args: {
    charges: chargeFixtures,
    details: new Map([
      [
        'price_01',
        {
          overriddenFrom: '$39.00',
          versions: [
            {
              id: 'v3',
              price: '$29.00',
              startDate: new Date('2026-03-01T00:00:00Z'),
              endDate: null,
              updatedAt: null,
            },
            {
              id: 'v2',
              price: '$34.00',
              startDate: new Date('2026-02-01T00:00:00Z'),
              endDate: new Date('2026-03-01T00:00:00Z'),
              updatedAt: null,
            },
            {
              id: 'v1',
              price: '$39.00',
              startDate: new Date('2026-01-01T00:00:00Z'),
              endDate: new Date('2026-02-01T00:00:00Z'),
              updatedAt: null,
            },
          ],
        },
      ],
      [
        'price_02',
        {
          commitment: {
            type: 'quantity' as const,
            value: '2,000,000 units',
            duration: null,
            overageFactor: 1.2,
            trueUp: false,
            windowed: false,
            windows: [],
          },
          alerts: [{ level: 'Warning', value: '80%' }],
          coupon: { code: 'WELCOME20', name: 'Welcome 20', discount: '20%', endsAt: null },
        },
      ],
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Price changed: open Platform base/ }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: /History: open Platform base/ }),
    ).toBeInTheDocument()
    // Fixed order, whatever order the detail was written in.
    const chips = canvas.getAllByRole('button', { name: /: open API calls/ })
    await expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Discount: open API calls',
      'Commitment: open API calls',
      'Alerts: open API calls',
    ])
    // The chip opens the sheet at its own part, not at the top.
    await userEvent.click(chips[1] as HTMLElement)
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('dialog')).toBeVisible()
    await expect(
      within(await screen.findByRole('dialog')).getByText('2,000,000 units'),
    ).toBeVisible()
  },
}

/**
 * Active, Changed and Ended.
 *
 * The views only appear where there is something to switch to: a plan whose
 * charges are all active and all as set shows one button, which is not a
 * choice. An ended charge keeps its row: it explains invoices that cite it:
 * and says when it ended on its grey line.
 */
export const Views: Story = {
  args: {
    charges: [
      ...chargeFixtures,
      {
        ...(chargeFixtures[0] as Charge),
        id: 'price_old',
        displayName: 'Legacy seat fee',
        endDate: new Date('2026-02-01T00:00:00Z'),
      },
    ],
    details: new Map([['price_01', { overriddenFrom: '$39.00' }]]),
    locale: 'en-US',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Status is a filter beside the billing model, not a row of chips above the table.
    await expect(canvas.queryByRole('button', { name: 'Active 3' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Charges' })).not.toHaveClass('sr-only')
    // Every charge is listed, live first; an ended one says when it ended.
    await expect(canvas.getByText('Legacy seat fee')).toBeInTheDocument()
    await expect(canvas.getByText('Fixed · Ended Feb 1, 2026')).toBeInTheDocument()
    await expect(canvas.getByText('Platform base')).toBeInTheDocument()
  },
}

/** The contract's Charges tab: "In effect" says when each charge starts and ends. */
export const WithDates: Story = {
  args: {
    charges: [
      { ...(chargeFixtures[0] as Charge), startDate: new Date('2026-01-01T00:00:00Z') },
      {
        ...(chargeFixtures[0] as Charge),
        id: 'price_old',
        displayName: 'Legacy seat fee',
        startDate: new Date('2025-06-01T00:00:00Z'),
        endDate: new Date('2026-02-01T00:00:00Z'),
      },
    ],
    showDates: true,
    locale: 'en-US',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'In effect' })).toBeInTheDocument()
    await expect(canvas.getByText('Jan 1, 2026 → Ongoing')).toBeInTheDocument()
    await expect(canvas.getByText('Jun 1, 2025 → Feb 1, 2026')).toBeInTheDocument()
    // Billing timing has its own column, beside the dates.
    await expect(canvas.getByRole('columnheader', { name: 'Billing timing' })).toBeInTheDocument()
  },
}

/**
 * The summary a contract's Overview shows: the live charges, changed ones
 * first, and a way to the rest, with no subtitle above it.
 */
export const Summary: Story = {
  args: {
    charges: chargeFixtures,
    variant: 'summary',
    details: new Map([['price_01', { overriddenFrom: '$39.00' }]]),
    onShowAll: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/active charges/)).not.toBeInTheDocument()
    const names = canvas.getAllByRole('row').map((row) => row.textContent ?? '')
    // The changed charge leads; the unchanged ones follow instead of vanishing.
    await expect(names.findIndex((text) => text.includes('Platform base'))).toBeLessThan(
      names.findIndex((text) => text.includes('Included storage')),
    )
    await userEvent.click(canvas.getByRole('button', { name: /show all charges/i }))
    await expect(args.onShowAll).toHaveBeenCalled()
  },
}

/** Nothing changed: the charges still list, as the plan sets them. */
export const SummaryUnchanged: Story = {
  args: { charges: chargeFixtures, variant: 'summary', onShowAll: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Included storage')).toBeInTheDocument()
    await expect(canvas.queryByText('No charges yet')).not.toBeInTheDocument()
  },
}

/**
 * Beside a side rail.
 *
 * The row must stay on one line, so the first two flags keep their label and
 * the rest shrink to the icon, which names itself on hover and keeps the same
 * accessible label either way.
 */
export const Narrow: Story = {
  args: {
    charges: chargeFixtures,
    layout: 'narrow',
    details: new Map([
      [
        'price_02',
        {
          overriddenFrom: '$0.004',
          coupon: { code: 'WELCOME20', name: 'Welcome 20', discount: '20%', endsAt: null },
          commitment: {
            type: 'quantity' as const,
            value: '10 units',
            duration: null,
            overageFactor: 1,
            trueUp: true,
            windowed: true,
            windows: [],
          },
          alerts: [{ level: 'Critical', value: '90%' }],
        },
      ],
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chips = canvas.getAllByRole('button', { name: /: open API calls/ })
    await expect(chips).toHaveLength(4)
    // Labelled, labelled, then icon-only: same accessible name either way.
    await expect(chips[0]).toHaveTextContent('Price changed')
    await expect(chips[1]).toHaveTextContent('Discount')
    await expect(chips[2]).toHaveTextContent('')
  },
}

/** With add, edit and terminate wired, each row carries an actions menu. */
export const WithActions: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  args: { charges: chargeFixtures, onAdd: fn(), onEdit: fn(), onTerminate: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /add charges/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Platform base' }))
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('menuitem', { name: 'Terminate' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Platform base' }),
    )
  },
}

export const Empty: Story = {
  args: { charges: [], onAdd: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('No charges yet')).toBeInTheDocument()
    // With an add flow wired, the copy may ask for a charge, and the button
    // sits in the empty body rather than the header.
    await expect(canvas.getByText(/add a fixed base or a usage charge/i)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /add charges/i })).toBeInTheDocument()
  },
}

/**
 * Empty on a surface with no add flow: the add-on page.
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
 * "A plan": which is what the add-on page used to show, verbatim.
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

/** Loading is a skeleton, never "No charges yet". */
export const Loading: Story = {
  args: { charges: [], isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Loading charges')).toBeInTheDocument()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
  },
}

/** A failed load says so and offers a retry; it never reads as "No charges yet". */
export const SubTabError: Story = {
  args: {
    charges: [],
    error: 'Could not load the charges.',
    errorKind: 'server',
    onRetry: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Could not load the charges.')).toBeInTheDocument()
    await expect(canvas.queryByText('No charges yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

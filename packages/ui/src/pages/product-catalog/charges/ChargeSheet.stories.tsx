import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within, waitFor } from 'storybook/test'
import {
  BillingModel,
  BillingPeriod,
  type Charge,
  type ChargeDetail,
  ChargeSection,
  CommitmentType,
  InvoiceCadence,
  PriceEntityType,
  PriceType,
  TierMode,
} from '@fp/domain'
import { ChargeSheet } from './ChargeSheet'

/**
 * One charge, opened from its row or from a flag: a box per part that exists,
 * and the version history under them. Presentational: the charge and what is
 * known about it go in, "edit this part" comes out. No network.
 */
const meta = {
  title: 'App/Product catalog/Charges/Charge sheet',
  component: ChargeSheet,
  parameters: { layout: 'fullscreen' },
  args: { onClose: fn(), locale: 'en-US' },
  argTypes: { charge: { control: false }, detail: { control: false } },
} satisfies Meta<typeof ChargeSheet>

export default meta
type Story = StoryObj<typeof meta>

const usage: Charge = {
  id: 'price_gpu',
  type: PriceType.Usage,
  billingModel: BillingModel.Tiered,
  amount: '',
  displayAmount: 'From $0.045',
  currency: 'usd',
  billingPeriod: BillingPeriod.Monthly,
  billingPeriodCount: 1,
  invoiceCadence: InvoiceCadence.Arrear,
  billingCadence: 'RECURRING',
  tierMode: TierMode.Slab,
  tiers: [
    { upTo: 30, unitAmount: '$0.0450' },
    { upTo: null, unitAmount: '$0.0400' },
  ],
  transformQuantity: null,
  bucketSize: null,
  meterId: 'meter_gpu',
  meterName: 'GPU hours',
  entityType: PriceEntityType.Plan,
  entityId: 'plan_01',
  lookupKey: 'gpu_hours',
  description: '',
  displayName: 'GPU hours · US',
  startDate: new Date('2026-03-01T00:00:00Z'),
  endDate: null,
  sequence: 3,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

const fixed: Charge = {
  ...usage,
  id: 'price_platform',
  type: PriceType.Fixed,
  billingModel: BillingModel.FlatFee,
  amount: '1800.00',
  displayAmount: '$1,800.00',
  invoiceCadence: InvoiceCadence.Advance,
  tierMode: null,
  tiers: [],
  meterId: null,
  meterName: null,
  displayName: 'Platform fee',
}

/** The plainest case: a price, and nothing else known. One box. */
export const PriceOnly: Story = {
  args: { charge: fixed },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('$1,800.00')).toBeInTheDocument()
    await expect(screen.getByText('Fixed · Flat fee · Monthly, in advance')).toBeInTheDocument()
    // No box exists for a part that does not.
    await expect(screen.queryByText('Commitment')).not.toBeInTheDocument()
    await expect(screen.queryByText('Discount')).not.toBeInTheDocument()
  },
}

/** A slab price whose top band is sold in packages of 100. */
export const PackageBand: Story = {
  args: {
    charge: {
      ...usage,
      tiers: [
        { upTo: 1000, unitAmount: '$0.0000' },
        { upTo: null, unitAmount: '$1,000', transformQuantity: { divideBy: 100, round: 'up' } },
      ],
    },
  },
}

/**
 * An overridden price.
 *
 * The plan's price sits grey underneath, not struck through: it is context for
 * the current number, not a correction of it.
 */
export const Overridden: Story = {
  args: {
    charge: fixed,
    detail: { overriddenFrom: '$2,000.00', quantity: '4' },
    onEdit: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Plan price $2,000.00')).toBeInTheDocument()
    await expect(screen.getByText('Changed here')).toBeInTheDocument()
    await expect(screen.getByText('× 4')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLElement)
    await expect(args.onEdit).toHaveBeenCalledWith(ChargeSection.Price)
  },
}

/** A commitment per billing period: one figure, and the three facts about it. */
export const CommitmentPerPeriod: Story = {
  args: {
    charge: usage,
    detail: {
      commitment: {
        type: CommitmentType.Quantity,
        value: '2,000,000 units',
        duration: BillingPeriod.Quarterly,
        overageFactor: 1.2,
        trueUp: false,
        windowed: false,
        windows: [],
      },
    } satisfies ChargeDetail,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('2,000,000 units')).toBeInTheDocument()
    await expect(screen.getByText('per quarterly')).toBeInTheDocument()
    await expect(screen.getByText('×1.2')).toBeInTheDocument()
    await expect(screen.getByText('Disabled')).toBeInTheDocument()
  },
}

/**
 * A commitment on every bucket, with two windows of the day at their own
 * figure. The dashed row answers the question a window raises: what happens
 * the rest of the time.
 */
export const CommitmentWindowed: Story = {
  args: {
    charge: usage,
    detail: {
      commitment: {
        type: CommitmentType.Quantity,
        value: '10 units',
        duration: null,
        overageFactor: 1,
        trueUp: true,
        windowed: true,
        windows: [
          {
            id: 'w1',
            start: '00:00',
            end: '08:00',
            value: '30 units',
            overageFactor: 1,
            trueUp: true,
            tiers: [
              { upTo: 30, unitAmount: '$0.0800' },
              { upTo: null, unitAmount: '$0.0600' },
            ],
          },
          {
            id: 'w2',
            start: '08:00',
            end: '20:00',
            value: '50 units',
            overageFactor: 1,
            trueUp: true,
          },
        ],
      },
    } satisfies ChargeDetail,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('00:00 – 08:00 UTC')).toBeInTheDocument()
    await expect(screen.getByText('08:00 – 20:00 UTC')).toBeInTheDocument()
    const commitment = within(screen.getByRole('region', { name: 'Commitment' }))
    await expect(commitment.getByText('Rest of the day')).toBeInTheDocument()
    await expect(commitment.getByText('10 units every month · From $0.045')).toBeInTheDocument()
    await expect(commitment.getByText('0 – 30')).toBeInTheDocument()
    await expect(commitment.getByText('$0.0800')).toBeInTheDocument()
    await expect(screen.getByText('Per month')).toBeInTheDocument()
  },
}

/** A windowed commitment whose charge is bucketed by the hour, not the billing period. */
export const CommitmentWindowedHourly: Story = {
  args: {
    ...CommitmentWindowed.args,
    charge: { ...usage, bucketSize: 'HOUR' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    const commitment = within(await screen.findByRole('region', { name: 'Commitment' }))
    await expect(commitment.getByText('10 units every hour · From $0.045')).toBeInTheDocument()
    await expect(screen.getByText('Per hour')).toBeInTheDocument()
  },
}

/**
 * Every part at once, opened at the commitment.
 *
 * Boxes keep their fixed order whatever was clicked: the ring says where the
 * click landed, the order stays learnable.
 */
export const OpenedAtASection: Story = {
  args: {
    charge: usage,
    section: ChargeSection.Commitment,
    detail: {
      overriddenFrom: '$0.0500',
      commitment: {
        type: CommitmentType.Amount,
        value: '$1,800.00',
        duration: null,
        overageFactor: 1,
        trueUp: true,
        windowed: false,
        windows: [],
      },
      coupon: {
        code: 'WELCOME20',
        name: 'Welcome 20',
        discount: '20%',
        endsAt: new Date('2026-12-31T00:00:00Z'),
      },
      alerts: [
        { level: 'Warning', value: '80%' },
        { level: 'Critical', value: '95%' },
      ],
      versions: [
        {
          id: 'v3',
          price: '$0.0450',
          startDate: new Date('2026-03-01T00:00:00Z'),
          endDate: null,
          updatedAt: new Date('2026-03-01T00:00:00Z'),
          actor: 'Priya N',
        },
        {
          id: 'v2',
          price: '$0.0480',
          startDate: new Date('2026-02-01T00:00:00Z'),
          endDate: new Date('2026-03-01T00:00:00Z'),
          updatedAt: new Date('2026-02-01T00:00:00Z'),
        },
      ],
    } satisfies ChargeDetail,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)

    await waitFor(() => expect(screen.getByRole('region', { name: 'Commitment' })).toHaveFocus())

    /*
     * The boxes run in flag order, not the prototype's.
     *
     * A flag is a promise about where its click lands, so two orders for the
     * same five things is one too many. The prototype put Commitment second
     * and the handoff names that as a quirk to fix.
     */
    const boxes = screen
      .getAllByRole('region')
      .map((region) => region.getAttribute('id'))
      .filter((id): id is string => Boolean(id?.startsWith('charge-')))
    await expect(boxes).toEqual([
      'charge-price',
      'charge-discount',
      'charge-commitment',
      'charge-alerts',
      'charge-history',
    ])

    await expect(await screen.findByText('WELCOME20')).toBeInTheDocument()
    await expect(screen.getByText('Dec 31, 2026')).toBeInTheDocument()
    await expect(screen.getByText('Warning, above')).toBeInTheDocument()
    await expect(screen.getByText('2 versions')).toBeInTheDocument()
    await expect(screen.getByText('Current')).toBeInTheDocument()
    await expect(screen.getByText('By Priya N')).toBeInTheDocument()
  },
}

/** A single version is the charge as it stands, so there is no history section. */
export const OneVersionIsNotHistory: Story = {
  args: {
    charge: fixed,
    detail: {
      versions: [
        {
          id: 'v1',
          price: '$1,800.00',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: null,
          updatedAt: null,
        },
      ],
    } satisfies ChargeDetail,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('$1,800.00')).toBeInTheDocument()
    await expect(screen.queryByText('History')).not.toBeInTheDocument()
  },
}

/** API ordering cannot put an older version above the current price. */
export const HistoryNewestFirst: Story = {
  args: {
    ...OpenedAtASection.args,
    detail: {
      ...OpenedAtASection.args!.detail,
      versions: [...OpenedAtASection.args!.detail!.versions!].reverse(),
    },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    const current = await screen.findByText('Current')
    const row = current.closest('li')!
    await expect(within(row).getByText('$0.0450')).toBeVisible()
    await expect(within(row).getByText(/Last updated Mar 1, 2026/)).toBeVisible()
    await expect(row.parentElement!.firstElementChild).toBe(row)
  },
}

/**
 * Versions read from the history API as the sheet opened: they replace the
 * ones the page folded from its own list.
 */
export const HistoryFromApi: Story = {
  args: {
    ...OpenedAtASection.args,
    detail: { ...OpenedAtASection.args!.detail, versions: [] },
    history: { versions: OpenedAtASection.args!.detail!.versions },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByText('Current')).toBeVisible()
  },
}

/** The history read still running: the sheet says so where History goes. */
export const HistoryLoading: Story = {
  args: { charge: fixed, history: { isLoading: true } },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('status')).toHaveTextContent('Loading history')
  },
}

/** The history read failed: the reason, and a way to try again. */
export const HistoryFailed: Story = {
  args: {
    charge: fixed,
    history: { error: 'The history could not be loaded.', onRetry: fn() },
  },
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    const alert = await screen.findByRole('alert')
    await expect(alert).toHaveTextContent('The history could not be loaded.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await expect(args.history!.onRetry).toHaveBeenCalled()
  },
}

/**
 * A change scheduled for a later date: the price billing today stays Current,
 * the new one is Upcoming with the date it starts, and an ended one is History.
 */
export const ScheduledChange: Story = {
  args: {
    charge: fixed,
    detail: {
      versions: [
        {
          id: 'v1000',
          price: '₹1,000.00',
          startDate: new Date('2099-12-01T00:00:00Z'),
          endDate: null,
          updatedAt: new Date('2026-10-28T00:00:00Z'),
        },
        {
          id: 'v600',
          price: '₹600.00',
          startDate: new Date('2026-03-01T00:00:00Z'),
          endDate: new Date('2099-12-01T00:00:00Z'),
          updatedAt: new Date('2026-03-01T00:00:00Z'),
        },
        {
          id: 'v500',
          price: '₹500.00',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2026-03-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    } satisfies ChargeDetail,
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    // The tag, not the section heading of the same name: the one inside a row.
    const rowOf = async (tag: string) =>
      (await screen.findAllByText(tag)).map((el) => el.closest('li')).find(Boolean)!
    const current = await rowOf('Current')
    await expect(within(current).getByText('₹600.00')).toBeVisible()
    // Its end is scheduled, not past.
    await expect(within(current).getByText(/Ends Dec 1, 2099/)).toBeVisible()
    const upcoming = await rowOf('Upcoming')
    await expect(within(upcoming).getByText('₹1,000.00')).toBeVisible()
    await expect(within(upcoming).getByText('Starts Dec 1, 2099')).toBeVisible()
    const history = await rowOf('History')
    await expect(within(history).getByText('₹500.00')).toBeVisible()
  },
}

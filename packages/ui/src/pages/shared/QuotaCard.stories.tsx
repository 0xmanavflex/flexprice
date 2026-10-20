import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { QuotaCard } from './QuotaCard'

const meta = {
  title: 'Building blocks/Charts & metrics/QuotaCard',
  component: QuotaCard,
  parameters: { layout: 'padded' },
  args: {
    feature: 'API calls',
    label: 'API calls this period',
    unit: 'calls',
    used: 2000,
    included: 5000,
    percentUsed: 40,
    resetPeriodLabel: 'Monthly',
    resetsOn: new Date('2026-10-01T00:00:00Z'),
    locale: 'en-GB',
  },
  argTypes: {
    feature: { control: 'text' },
    label: { control: 'text' },
    unit: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    included: { control: { type: 'number', min: 0, step: 100 } },
    percentUsed: { control: { type: 'number', min: 0, max: 300, step: 1 } },
    resetPeriodLabel: { control: 'select', options: ['Monthly', 'Weekly', 'Daily', 'Yearly'] },
    resetsOn: { control: false },
    overage: { control: false },
    action: { control: false },
    locale: { control: 'select', options: ['en-GB', 'en-US', 'de-DE', 'fr-FR', 'en-IN'] },
    className: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuotaCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  feature: string
  unit: string
  used: number
  included: number
  state: 'limited' | 'unlimited' | 'not-reported'
  resetPeriodLabel: string
  showAction: boolean
}

/** Pick the entitlement state, then drag used past included to see the over-quota treatment. */
export const Playground = {
  args: {
    feature: 'API calls',
    unit: 'calls',
    used: 2000,
    included: 5000,
    state: 'limited',
    resetPeriodLabel: 'Monthly',
    showAction: true,
  },
  argTypes: {
    feature: { control: 'text' },
    unit: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    included: { control: { type: 'number', min: 0, step: 100 } },
    state: { control: 'inline-radio', options: ['limited', 'unlimited', 'not-reported'] },
    resetPeriodLabel: { control: 'select', options: ['Monthly', 'Weekly', 'Daily', 'Yearly'] },
    showAction: { control: 'boolean' },
  },
  parameters: {
    controls: {
      include: ['feature', 'unit', 'used', 'included', 'state', 'resetPeriodLabel', 'showAction'],
    },
  },
  render: ({ feature, unit, used, included, state, resetPeriodLabel, showAction }) => (
    <div className="mx-auto max-w-sm">
      <QuotaCard
        feature={feature}
        label={`${feature} this period`}
        unit={unit}
        used={state === 'not-reported' ? undefined : used}
        included={state === 'limited' ? included : state === 'unlimited' ? null : undefined}
        percentUsed={
          state === 'limited' && included > 0 ? Math.round((used / included) * 100) : undefined
        }
        resetPeriodLabel={resetPeriodLabel}
        resetsOn={state === 'not-reported' ? null : new Date('2026-10-01T00:00:00Z')}
        action={showAction ? { label: 'View usage', onClick: fn() } : undefined}
        locale="en-GB"
      />
    </div>
  ),
} satisfies StoryObj<PlaygroundArgs>

/**
 * The six readings, all present except the one nothing sources. The meter's
 * accessible name carries the whole reading, so the bar is not the only way to
 * learn the number.
 */
export const EveryReadingIsText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole('progressbar', {
        name: 'API calls this period: 2,000 calls of 5,000 used (40%)',
      }),
    ).toBeInTheDocument()

    await expect(canvas.getByText('2,000 calls')).toBeInTheDocument() // used
    await expect(canvas.getByText('3,000 calls left')).toBeInTheDocument() // remaining
    await expect(canvas.getByText('of 5,000 monthly quota')).toBeInTheDocument() // included
    await expect(canvas.getByText('1 October 2026')).toBeInTheDocument() // reset date
  },
}

/**
 * Nothing prices a per-feature overage, so there is no cost slot: no
 * "Overage —" beside "Over by", and never a figure this component computed.
 */
export const NoOverageSlotWithoutAPrice: Story = {
  args: { used: 6200, percentUsed: 124 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/Overage/)).not.toBeInTheDocument()
    await expect(canvas.queryByText(/[$£€]/)).not.toBeInTheDocument()
    await expect(canvas.getByText('Over by 1,200 calls')).toBeInTheDocument()
  },
}

/** A priced overage, when a caller has one, takes the slot. */
export const PricedOverage: Story = {
  args: { used: 6200, percentUsed: 124, overage: '$12.00' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Overage/)).toBeInTheDocument()
    await expect(canvas.getByText('$12.00')).toBeInTheDocument()
  },
}

/**
 * The bar follows the counts, not the API's percentage. 291 used of 10 is a
 * full, destructive bar even when `usage_percent` says 29.1.
 */
export const BarFollowsTheCounts: Story = {
  args: { feature: 'AI Messages', unit: undefined, used: 291, included: 10, percentUsed: 29.1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = canvas.getByRole('progressbar', {
      name: 'API calls this period: 291 of 10 used (2,910%)',
    })
    await expect(bar).toHaveAttribute('aria-valuenow', '100')
    await expect(canvas.getByText('Over by 281')).toBeInTheDocument()
  },
}

/**
 * Past the included amount: the bar caps at full and turns to the status token,
 * but the reading keeps counting. A soft limit is billed, not blocked, so the
 * number matters after 100%.
 */
export const OverQuota: Story = {
  args: { used: 6200, percentUsed: 124 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Over by 1,200 calls')).toBeInTheDocument()
    await expect(canvas.queryByText(/left/)).not.toBeInTheDocument()
    await expect(
      canvas.getByRole('progressbar', {
        name: 'API calls this period: 6,200 calls of 5,000 used (124%)',
      }),
    ).toBeInTheDocument()
  },
}

/** Exactly at the limit — full bar, nothing left, and not yet an overage. */
export const Exhausted: Story = {
  args: { used: 5000, percentUsed: 100 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('0 calls left')).toBeInTheDocument()
    await expect(canvas.queryByText(/Over by/)).not.toBeInTheDocument()
  },
}

/**
 * A static entitlement: no cap reported and no reset date. Every unsourced
 * reading is a dash, and none of them is a zero.
 */
export const NothingReported: Story = {
  args: {
    feature: 'Dedicated support',
    label: 'Dedicated support this period',
    unit: undefined,
    used: undefined,
    included: undefined,
    percentUsed: undefined,
    resetPeriodLabel: undefined,
    resetsOn: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('— included')).toBeInTheDocument()
    await expect(canvas.getByText('— remaining')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
    await expect(canvas.queryByText('0')).not.toBeInTheDocument()
  },
}

/**
 * A zero allowance is a real allowance, and dividing by it is how `NaN%`
 * reaches a billing screen.
 */
export const ZeroAllowance: Story = {
  args: { included: 0, used: 0, percentUsed: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/NaN/)).not.toBeInTheDocument()
  },
}

/** With a way through to the feature's own usage. */
export const WithAction: Story = {
  args: { action: { label: 'View usage', onClick: () => {} } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'View usage' }),
    ).toBeInTheDocument()
  },
}

/** A long feature name truncates rather than pushing the action off the card. */
export const LongNameTruncates: Story = {
  args: {
    feature: 'Real-time streaming transcription minutes, premium acoustic model',
    action: { label: 'View usage', onClick: () => {} },
  },
}

/** An unparseable renewal date shows the dash, never "Invalid Date". */
export const InvalidRenewalDate: Story = {
  args: { resetsOn: new Date('not a date') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Invalid Date/)).not.toBeInTheDocument()
  },
}

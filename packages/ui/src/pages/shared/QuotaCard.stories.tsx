import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { QuotaCard } from './QuotaCard'

const meta = {
  title: 'Foundation/Flexprice/QuotaCard',
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
    overageNote: 'Flexprice does not price a per-feature overage.',
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
    overageNote: { control: 'text' },
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
  showOverageNote: boolean
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
    showOverageNote: true,
  },
  argTypes: {
    feature: { control: 'text' },
    unit: { control: 'text' },
    used: { control: { type: 'number', min: 0, step: 100 } },
    included: { control: { type: 'number', min: 0, step: 100 } },
    state: { control: 'inline-radio', options: ['limited', 'unlimited', 'not-reported'] },
    resetPeriodLabel: { control: 'select', options: ['Monthly', 'Weekly', 'Daily', 'Yearly'] },
    showAction: { control: 'boolean' },
    showOverageNote: { control: 'boolean' },
  },
  parameters: {
    controls: {
      include: [
        'feature',
        'unit',
        'used',
        'included',
        'state',
        'resetPeriodLabel',
        'showAction',
        'showOverageNote',
      ],
    },
  },
  render: ({
    feature,
    unit,
    used,
    included,
    state,
    resetPeriodLabel,
    showAction,
    showOverageNote,
  }) => (
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
        overageNote={
          showOverageNote ? 'Flexprice does not price a per-feature overage.' : undefined
        }
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
 * The regression guard for the rule this card exists to keep: the overage slot
 * has no source, so it is a dash with the reason beside it — never a figure
 * this component computed.
 */
export const OverageStaysADash: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Flexprice does not price a per-feature overage.'),
    ).toBeInTheDocument()
    // The slot names itself, so the dash reads as an answer and not a glitch.
    await expect(canvas.getByText(/Overage/)).toBeInTheDocument()
    await expect(canvas.getByText('—')).toBeInTheDocument()
    // Nothing invented a currency to fill the slot with.
    await expect(canvas.queryByText(/[$£€]/)).not.toBeInTheDocument()
  },
}

/**
 * In a grid the reason is stated once beneath it, not once per card, so the
 * note is opt-in. The slot is still labelled, so the dash is still legible.
 */
export const NoteOmittedInAGrid: Story = {
  args: { overageNote: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(/does not price/)).not.toBeInTheDocument()
    await expect(canvas.getByText(/Overage/)).toBeInTheDocument()
    await expect(canvas.getByText('—')).toBeInTheDocument()
  },
}

/**
 * `included: null` is unlimited. Not a full bar, not an empty one — no bar at
 * all, because there is no denominator to draw one against.
 */
export const Unlimited: Story = {
  args: { included: null, used: 128_400, percentUsed: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Unlimited')).toBeInTheDocument()
    await expect(canvas.getByText('no included limit')).toBeInTheDocument()
    await expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument()
    // The bug this story exists for: a `?? 0` rendering "0 of 0".
    await expect(canvas.queryByText(/of 0/)).not.toBeInTheDocument()
    await expect(canvas.getByText('128,400 calls')).toBeInTheDocument()
  },
}

/** Nothing used yet. An honest zero, and a bar that is genuinely empty. */
export const Zero: Story = {
  args: { used: 0, percentUsed: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('0 calls')).toBeInTheDocument()
    await expect(canvas.getByText('5,000 calls left')).toBeInTheDocument()
    await expect(
      canvas.getByRole('progressbar', {
        name: 'API calls this period: 0 calls of 5,000 used (0%)',
      }),
    ).toBeInTheDocument()
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

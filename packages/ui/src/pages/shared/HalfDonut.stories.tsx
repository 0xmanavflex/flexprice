import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { HalfDonut } from './HalfDonut'
import type { DonutSlice } from './HalfDonut'

/**
 * Invoice payment status: states, so status tones. `good`/`warning`/`critical`
 * are reserved for exactly this, which is why the categorical slots are absent
 * here even though there are three of them.
 */
const invoices: DonutSlice[] = [
  { id: 'paid', label: 'Paid', value: 412, tone: 'good' },
  { id: 'open', label: 'Open', value: 96, tone: 'warning' },
  { id: 'overdue', label: 'Overdue', value: 31, tone: 'critical' },
]

const unitFormats = {
  integer: (value: number) => new Intl.NumberFormat('en-US').format(value),
  currency: (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value),
  compact: (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value),
} as const

const meta = {
  title: 'Building blocks/Charts & metrics/HalfDonut',
  component: HalfDonut,
  parameters: { layout: 'padded' },
  args: {
    slices: invoices,
    centerLabel: 'Invoices',
    centerValue: '539',
    label: 'Invoice payment status',
  },
  argTypes: {
    slices: { control: false },
    centerLabel: { control: 'text' },
    centerValue: { control: 'text' },
    label: { control: 'text' },
    format: { control: false },
    className: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="bg-card mx-auto w-full max-w-[360px] rounded-xl border p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HalfDonut>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  paid: number
  open: number
  overdue: number
  statusTones: boolean
  valueFormat: keyof typeof unitFormats
  centerLabel: string
  label: string
}

/** Drive the three slice values, switch status vs categorical tones, and change the number format. Set all to 0 for the empty ring. */
export const Playground = {
  args: {
    paid: 412,
    open: 96,
    overdue: 31,
    statusTones: true,
    valueFormat: 'integer',
    centerLabel: 'Invoices',
    label: 'Invoice payment status',
  },
  argTypes: {
    paid: { control: { type: 'number', min: 0, step: 10 } },
    open: { control: { type: 'number', min: 0, step: 10 } },
    overdue: { control: { type: 'number', min: 0, step: 10 } },
    statusTones: { control: 'boolean', description: 'Status tones vs categorical series tones.' },
    valueFormat: { control: 'inline-radio', options: Object.keys(unitFormats) },
    centerLabel: { control: 'text' },
    label: { control: 'text' },
  },
  parameters: {
    controls: {
      include: ['paid', 'open', 'overdue', 'statusTones', 'valueFormat', 'centerLabel', 'label'],
    },
  },
  render: ({ paid, open, overdue, statusTones, valueFormat, centerLabel, label }) => {
    const format = unitFormats[valueFormat]
    const slices: DonutSlice[] = [
      { id: 'paid', label: 'Paid', value: paid, tone: statusTones ? 'good' : 'series-1' },
      { id: 'open', label: 'Open', value: open, tone: statusTones ? 'warning' : 'series-2' },
      {
        id: 'overdue',
        label: 'Overdue',
        value: overdue,
        tone: statusTones ? 'critical' : 'series-3',
      },
    ]
    return (
      <HalfDonut
        slices={slices}
        centerLabel={centerLabel}
        centerValue={format(paid + open + overdue)}
        format={format}
        label={label}
      />
    )
  },
} satisfies StoryObj<PlaygroundArgs>

/** The footer is the legend: every slice is named and counted in text. */
export const FooterIsTheLegend: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const slice of invoices) {
      await expect(canvas.getByText(slice.label)).toBeInTheDocument()
    }
    await expect(canvas.getByText('412')).toBeInTheDocument()
    await expect(
      canvas.getByRole('img', { name: /Paid 412, Open 96, Overdue 31/ }),
    ).toBeInTheDocument()
  },
}

/** Categorical slices: different things, not better or worse things. */
export const Categorical: Story = {
  args: {
    slices: [
      { id: 'recurring', label: 'Recurring', value: 51000, tone: 'series-1' },
      { id: 'usage', label: 'Usage', value: 26500, tone: 'series-2' },
      { id: 'one-off', label: 'One-off', value: 7400, tone: 'series-3' },
    ],
    centerLabel: 'Revenue',
    centerValue: '$84.9k',
    label: 'Revenue by kind',
    format: (value: number) => `$${(value / 1000).toFixed(1)}k`,
  },
}

/** One state accounts for everything. The ring is whole, the footer still reads. */
export const SingleSlice: Story = {
  args: {
    slices: [
      { id: 'paid', label: 'Paid', value: 120, tone: 'good' },
      { id: 'open', label: 'Open', value: 0, tone: 'warning' },
      { id: 'overdue', label: 'Overdue', value: 0, tone: 'critical' },
    ],
    centerValue: '120',
  },
}

/** Nothing finalized in the window: a muted track and a real zero, not a hole. */
export const AllZero: Story = {
  args: {
    slices: invoices.map((slice) => ({ ...slice, value: 0 })),
    centerValue: '0',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: /nothing in this period/i })).toBeInTheDocument()
    await expect(canvas.getByText('Invoices')).toBeInTheDocument()
  },
}

/** Still loading: the ring and the legend keep their shape, but no number is drawn, least of all a 0. */
export const Loading: Story = {
  args: { status: 'loading', centerValue: '0' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('img', { name: /Invoice payment status: loading/i }),
    ).toBeInTheDocument()
    await expect(canvas.queryByText('0')).toBeNull()
    await expect(canvas.queryByText('412')).toBeNull()
  },
}

/** The request failed: "Unavailable" with a retry, never a zero ring. */
export const ErrorState: Story = {
  args: { status: 'error', centerValue: '0', onRetry: () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Unavailable').length).toBeGreaterThan(0)
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    await expect(canvas.queryByText('0')).toBeNull()
  },
}

/** The window is genuinely empty: an em dash, not a counted zero. */
export const EmptyStatus: Story = {
  args: { status: 'empty', centerValue: '0', slices: invoices.map((s) => ({ ...s, value: 0 })) },
}

/**
 * A long label ellipses inside its column instead of overflowing into the next.
 *
 * This is a regression guard for a real bug. The legend's inner flex row had no
 * `min-w-0`, so it sized to its content and the `truncate` below it never
 * engaged: a long label simply ran over its neighbour. Every other story here
 * feeds short words ("Paid", "Open"), which is exactly why it survived: it took
 * real feature names on the revenue mix to make it visible.
 *
 * The assertion is on geometry rather than on a class, because the class was
 * always present: it was the missing constraint above it that made it inert.
 */
export const LongLabelsTruncate: Story = {
  args: {
    label: 'Metered usage by feature',
    centerLabel: 'Events',
    centerValue: '19.1M',
    slices: [
      {
        id: 'api',
        label: 'API calls per authenticated tenant',
        value: 13_200_000,
        tone: 'series-1',
      },
      { id: 'tokens', label: 'Tokens processed by the model', value: 3_200_000, tone: 'series-2' },
      { id: 'other', label: 'Other metered features', value: 2_700_000, tone: 'neutral' },
    ],
  },
  play: async ({ canvasElement }) => {
    const label = within(canvasElement).getByText('API calls per authenticated tenant')
    // Clipped, not spilling: the element is narrower than the text inside it.
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth)

    // And it stays inside its own column: the bug let it cover its neighbour.
    const column = label.closest('li')
    await expect(column).not.toBeNull()
    const labelBox = label.getBoundingClientRect()
    const columnBox = column!.getBoundingClientRect()
    await expect(labelBox.right).toBeLessThanOrEqual(Math.ceil(columnBox.right))
  },
}

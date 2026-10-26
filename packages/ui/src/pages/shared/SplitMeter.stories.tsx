import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SplitMeter } from './SplitMeter'
import type { SplitMeterPart } from './SplitMeter'

const parts: SplitMeterPart[] = [
  { id: 'recurring', label: 'Recurring', value: 51_000 },
  { id: 'usage', label: 'Usage', value: 26_500 },
  { id: 'one-off', label: 'One-off', value: 7_400 },
]

const money = (value: number) => `$${(value / 1000).toFixed(1)}k`

const statusTones = ['good', 'warning', 'critical'] as const

const meta = {
  title: 'Building blocks/Charts & metrics/SplitMeter',
  component: SplitMeter,
  parameters: { layout: 'padded' },
  args: {
    parts,
    title: 'Revenue by kind',
    value: '$84.9k',
    format: money,
    label: 'Revenue by kind',
  },
  argTypes: {
    parts: { control: false },
    total: { control: { type: 'number', min: 0, step: 5000 } },
    segments: { control: { type: 'range', min: 8, max: 80, step: 1 } },
    title: { control: 'text' },
    value: { control: 'text' },
    label: { control: 'text' },
    format: { control: false },
    className: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="bg-card mx-auto w-full max-w-lg rounded-xl border p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  recurring: number
  usage: number
  oneOff: number
  hasCeiling: boolean
  ceiling: number
  statusTones: boolean
  segments: number
  title: string
  label: string
}

/** Drive each part, add a ceiling to see unfilled track, or switch to status tones. */
export const Playground = {
  args: {
    recurring: 51_000,
    usage: 26_500,
    oneOff: 7_400,
    hasCeiling: false,
    ceiling: 120_000,
    statusTones: false,
    segments: 48,
    title: 'Revenue by kind',
    label: 'Revenue by kind',
  },
  argTypes: {
    recurring: { control: { type: 'number', min: 0, step: 1000 } },
    usage: { control: { type: 'number', min: 0, step: 1000 } },
    oneOff: { control: { type: 'number', min: 0, step: 1000 } },
    hasCeiling: { control: 'boolean' },
    ceiling: { control: { type: 'number', min: 0, step: 5000 } },
    statusTones: { control: 'boolean' },
    segments: { control: { type: 'range', min: 8, max: 80, step: 1 } },
    title: { control: 'text' },
    label: { control: 'text' },
  },
  parameters: {
    controls: {
      include: [
        'recurring',
        'usage',
        'oneOff',
        'hasCeiling',
        'ceiling',
        'statusTones',
        'segments',
        'title',
        'label',
      ],
    },
  },
  render: ({ recurring, usage, oneOff, hasCeiling, ceiling, statusTones: status, ...rest }) => {
    const values = [recurring, usage, oneOff]
    const labels = ['Recurring', 'Usage', 'One-off']
    const list: SplitMeterPart[] = values.map((value, index) => ({
      id: `part-${index}`,
      label: labels[index]!,
      value,
      ...(status ? { tone: statusTones[index]! } : {}),
    }))
    const sum = values.reduce((acc, value) => acc + value, 0)
    return (
      <SplitMeter
        {...rest}
        parts={list}
        total={hasCeiling ? ceiling : undefined}
        value={money(sum)}
        format={money}
      />
    )
  },
} satisfies StoryObj<PlaygroundArgs>

/** Several tones in one track, so the legend is not optional. */
export const LegendNamesEveryPart: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const part of parts) {
      await expect(canvas.getByText(part.label)).toBeInTheDocument()
    }
    await expect(
      canvas.getByRole('button', {
        name: /Revenue by kind: Recurring \$51.0k, Usage \$26.5k, One-off \$7.4k/,
      }),
    ).toBeInTheDocument()
  },
}

/**
 * With a ceiling the shortfall stays visible as unfilled track: the gap is the
 * whole message, and it is a different claim from "these are shares of each
 * other".
 */
export const AgainstACommitment: Story = {
  args: {
    parts: [
      { id: 'drawn', label: 'Drawn down', value: 62_000 },
      { id: 'pending', label: 'Pending', value: 8_000 },
    ],
    total: 120_000,
    title: 'Annual commitment',
    value: '$70.0k of $120.0k',
    label: 'Commitment drawdown',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', {
        name: /Commitment drawdown: Drawn down \$62.0k, Pending \$8.0k of \$120.0k/,
      }),
    ).toBeInTheDocument()
  },
}

/** Status parts, where the split is between states rather than categories. */
export const StatusParts: Story = {
  args: {
    parts: [
      { id: 'paid', label: 'Paid', value: 412, tone: 'good' },
      { id: 'open', label: 'Open', value: 96, tone: 'warning' },
      { id: 'overdue', label: 'Overdue', value: 31, tone: 'critical' },
    ],
    title: 'Invoices',
    value: '539',
    format: (value: number) => String(value),
    label: 'Invoice payment status',
  },
}

/** A part small enough to round away still takes a segment. */
export const TinyPart: Story = {
  args: {
    parts: [
      { id: 'recurring', label: 'Recurring', value: 99_000 },
      { id: 'one-off', label: 'One-off', value: 120 },
    ],
    value: '$99.1k',
  },
}

/** Nothing earned yet: an empty track, and a legend that still explains it. */
export const AllZero: Story = {
  args: {
    parts: parts.map((part) => ({ ...part, value: 0 })),
    value: '$0.0k',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', {
        name: /Revenue by kind: Recurring \$0.0k, Usage \$0.0k, One-off \$0.0k/,
      }),
    ).toBeInTheDocument()
  },
}

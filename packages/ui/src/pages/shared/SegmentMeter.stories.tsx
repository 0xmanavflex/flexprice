import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SegmentMeter } from './SegmentMeter'
import type { SegmentMeterRow } from './SegmentMeter'

const rows: SegmentMeterRow[] = [
  {
    id: 'api_calls',
    label: 'API calls',
    caption: 'api_calls',
    value: 1_284_000,
    changePercent: 14.2,
  },
  {
    id: 'tokens',
    label: 'Tokens processed',
    caption: 'tokens_processed',
    value: 842_500,
    changePercent: 6.1,
  },
  {
    id: 'voice',
    label: 'Voice minutes',
    caption: 'voice_minutes',
    value: 391_200,
    changePercent: -2.4,
  },
  { id: 'storage', label: 'Storage GB-hours', caption: 'storage_gb_hours', value: 96_400 },
  { id: 'webhooks', label: 'Webhook deliveries', caption: 'webhook_deliveries', value: 12_800 },
]

/** `count` rows from the fixture, cycling past five with numbered names. */
function makeRows(count: number, quota: number | undefined, showDelta: boolean): SegmentMeterRow[] {
  return Array.from({ length: count }, (_, index) => {
    const base = rows[index % rows.length]!
    const round = Math.floor(index / rows.length)
    const scale = 1 / (1 + round * 0.4)
    return {
      id: `${base.id}_${index}`,
      label: round === 0 ? base.label : `${base.label} ${round + 1}`,
      caption: base.caption,
      value: Math.round(base.value * scale),
      ...(quota === undefined ? {} : { max: quota }),
      ...(showDelta && base.changePercent !== undefined
        ? { changePercent: base.changePercent }
        : {}),
    }
  })
}

const meta = {
  title: 'Building blocks/Charts & metrics/SegmentMeter',
  component: SegmentMeter,
  parameters: { layout: 'padded' },
  args: { rows, label: 'Usage by feature' },
  argTypes: {
    rows: { control: false },
    segments: { control: { type: 'range', min: 8, max: 80, step: 1 } },
    label: { control: 'text' },
    emptyMessage: { control: 'text' },
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
} satisfies Meta<typeof SegmentMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

interface PlaygroundArgs {
  rowCount: number
  quota: number
  useQuota: boolean
  showDelta: boolean
  segments: number
  label: string
  emptyMessage: string
}

/** Drag rowCount from 0 (empty state) to 15; tick useQuota to measure each row against a ceiling. */
export const Playground = {
  args: {
    rowCount: 5,
    quota: 1_500_000,
    useQuota: false,
    showDelta: true,
    segments: 48,
    label: 'Usage by feature',
    emptyMessage: 'Nothing to show for this period',
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 15, step: 1 } },
    quota: { control: { type: 'number', min: 1, step: 100_000 } },
    useQuota: { control: 'boolean' },
    showDelta: { control: 'boolean' },
    segments: { control: { type: 'range', min: 8, max: 80, step: 1 } },
    label: { control: 'text' },
    emptyMessage: { control: 'text' },
  },
  parameters: {
    controls: {
      include: ['rowCount', 'quota', 'useQuota', 'showDelta', 'segments', 'label', 'emptyMessage'],
    },
  },
  render: ({ rowCount, quota, useQuota, showDelta, ...rest }) => (
    <SegmentMeter {...rest} rows={makeRows(rowCount, useQuota ? quota : undefined, showDelta)} />
  ),
} satisfies StoryObj<PlaygroundArgs>

/**
 * The figure behind the approximation is reachable without a mouse: every track
 * is a focusable control carrying the exact reading as its name.
 */
export const ReadingsAreReachable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tracks = canvas.getAllByRole('button')
    await expect(tracks).toHaveLength(rows.length)
    // The busiest row is the yardstick, so it reads 100%.
    await expect(
      canvas.getByRole('button', { name: /API calls: 1,284,000 of 1,284,000, 100%/ }),
    ).toBeInTheDocument()
  },
}

/**
 * Given a real ceiling, rows are measured against it rather than each other:
 * so the busiest row is no longer automatically full.
 */
export const AgainstAQuota: Story = {
  args: {
    rows: [
      { id: 'api_calls', label: 'API calls', value: 640_000, max: 2_000_000 },
      { id: 'tokens', label: 'Tokens processed', value: 1_900_000, max: 2_000_000 },
      { id: 'voice', label: 'Voice minutes', value: 90_000, max: 2_000_000 },
    ],
    label: 'Usage against entitlement',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /API calls: 640,000 of 2,000,000, 32%/ }),
    ).toBeInTheDocument()
  },
}

/** Every row zero: bare tracks, and no row pretending to be the busiest. */
export const AllZero: Story = {
  args: { rows: rows.map((row) => ({ ...row, value: 0, changePercent: 0 })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /API calls: 0 of 0, 0%/ })).toBeInTheDocument()
  },
}

/** Nothing measured at all. A sentence, announced, rather than an empty box. */
export const NoRows: Story = {
  args: { rows: [], emptyMessage: 'No metered features used in this period' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'No metered features used in this period',
    )
  },
}

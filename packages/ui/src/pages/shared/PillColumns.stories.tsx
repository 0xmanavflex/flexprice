import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { PillColumns } from './PillColumns'
import type { PillColumn } from './PillColumns'

const series = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'scale', label: 'Scale' },
]

const columns: PillColumn[] = [
  { label: 'Mon', values: { starter: 12, growth: 7, scale: 2 } },
  { label: 'Tue', values: { starter: 9, growth: 11, scale: 4 } },
  { label: 'Wed', values: { starter: 15, growth: 9, scale: 3 } },
  { label: 'Thu', values: { starter: 6, growth: 5, scale: 1 } },
  { label: 'Fri', values: { starter: 18, growth: 14, scale: 6 } },
  { label: 'Sat', values: { starter: 4, growth: 2, scale: 0 } },
  { label: 'Sun', values: { starter: 3, growth: 1, scale: 0 } },
]

const meta = {
  title: 'Building blocks/Charts & metrics/PillColumns',
  component: PillColumns,
  parameters: { layout: 'padded' },
  args: { columns, series, label: 'New contracts by day and plan' },
} satisfies Meta<typeof PillColumns>

export default meta
type Story = StoryObj<typeof meta>

const SERIES_POOL = [
  { id: 'starter', label: 'Starter' },
  { id: 'growth', label: 'Growth' },
  { id: 'scale', label: 'Scale' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'partner', label: 'Partner' },
]

const COLUMN_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Deterministic grid: column labels cycle the week, values follow a fixed wave scaled by `scale`. */
function makeColumns(columnCount: number, seriesCount: number, scale: number, allZero: boolean) {
  return Array.from({ length: columnCount }, (_, column): PillColumn => {
    const values: Record<string, number> = {}
    SERIES_POOL.slice(0, seriesCount).forEach((entry, index) => {
      const wave = ((column * 7 + index * 5) % 11) + 1
      values[entry.id] = allZero ? 0 : Math.round((wave * scale) / (index + 1))
    })
    const base = COLUMN_LABELS[column % COLUMN_LABELS.length] ?? ''
    return {
      label: column >= COLUMN_LABELS.length ? `${base} ${Math.floor(column / 7) + 1}` : base,
      values,
    }
  })
}

interface PlaygroundArgs {
  columnCount: number
  seriesCount: number
  scale: number
  rows: number
  allZero: boolean
  label: string
}

/** Drag columns from 0 to 14 and series from 1 to 5 to see the empty, normal and crowded states. */
export const Playground = {
  args: {
    columnCount: 7,
    seriesCount: 3,
    scale: 2,
    rows: 7,
    allZero: false,
    label: 'New contracts by day and plan',
  },
  argTypes: {
    columnCount: { control: { type: 'range', min: 0, max: 14, step: 1 } },
    seriesCount: { control: { type: 'range', min: 1, max: SERIES_POOL.length, step: 1 } },
    scale: {
      control: { type: 'range', min: 1, max: 20, step: 1 },
      description: 'Multiplies every value.',
    },
    rows: {
      control: { type: 'range', min: 3, max: 12, step: 1 },
      description: 'Slabs per column.',
    },
    allZero: { control: 'boolean' },
    label: { control: 'text' },
  },
  parameters: {
    controls: { include: ['columnCount', 'seriesCount', 'scale', 'rows', 'allZero', 'label'] },
  },
  render: ({ columnCount, seriesCount, scale, rows, allZero, label }) => (
    <PillColumns
      columns={makeColumns(columnCount, seriesCount, scale, allZero)}
      series={SERIES_POOL.slice(0, seriesCount)}
      rows={rows}
      label={label}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {}

/**
 * Identity never rests on colour: the legend names every series, and each
 * column carries its full breakdown as an accessible name.
 */
export const LegendAndReadings: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const item of series) {
      await expect(canvas.getByText(item.label)).toBeInTheDocument()
    }
    await expect(
      canvas.getByRole('button', { name: /Fri: 38 total, Starter 18, Growth 14, Scale 6/ }),
    ).toBeInTheDocument()
  },
}

/** Two series is where a legend starts mattering, and the common revenue case. */
export const TwoSeries: Story = {
  args: {
    series: [
      { id: 'recurring', label: 'Recurring' },
      { id: 'usage', label: 'Usage' },
    ],
    columns: [
      { label: 'Jan', values: { recurring: 42000, usage: 11000 } },
      { label: 'Feb', values: { recurring: 45000, usage: 15500 } },
      { label: 'Mar', values: { recurring: 47500, usage: 21000 } },
      { label: 'Apr', values: { recurring: 51000, usage: 26500 } },
    ],
    label: 'Revenue by month and kind',
  },
}

/** A column whose parts are tiny still shows them: one segment, never none. */
export const SmallShares: Story = {
  args: {
    columns: [
      { label: 'Mon', values: { starter: 400, growth: 3, scale: 1 } },
      { label: 'Tue', values: { starter: 380, growth: 2, scale: 1 } },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Mon: 404 total, Starter 400, Growth 3, Scale 1/ }),
    ).toBeInTheDocument()
  },
}

/** Every column zero: bare tracks, no phantom bars, and the labels still read. */
export const AllZero: Story = {
  args: {
    columns: columns.map((column) => ({
      label: column.label,
      values: { starter: 0, growth: 0, scale: 0 },
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: /Mon: 0 total, Starter 0, Growth 0, Scale 0/ }),
    ).toBeInTheDocument()
  },
}

/** No columns at all: the legend survives so the panel is still self-describing. */
export const NoColumns: Story = {
  args: { columns: [] },
}

/**
 * The mark is `@reui/stats-14`'s, and this is the guard that keeps it so.
 *
 * This component's first version claimed stats-14 in its provenance and drew
 * something else entirely: variable-height stacks of `rounded-full` pills:
 * and nothing caught it, because every test here asserted on readings and
 * labels rather than on the mark. A provenance note is a claim, and an
 * unchecked claim drifts.
 *
 * So these assertions are deliberately about geometry: the slab's height and
 * radius, the 4px gap that sets the gutter, and the fixed row count. If a
 * redesign genuinely moves off the block, delete this story along with the
 * provenance entry: do not loosen it until it passes.
 */
export const MatchesTheBlocksMark: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slabs = canvas
      .getByRole('button', { name: /^Mon:/ })
      .querySelectorAll('span[aria-hidden="true"]')

    // A fixed grid: seven slabs, present whether lit or not.
    await expect(slabs.length).toBe(7)

    // `gap-1` on the column, the reference's 4px gutter between slabs.
    const column = canvas.getByRole('button', { name: /^Mon:/ })
    await expect(getComputedStyle(column).rowGap).toBe('4px')

    for (const slab of Array.from(slabs)) {
      const box = slab.getBoundingClientRect()
      // `h-3`: 12px, not an elastic share of the column.
      await expect(Math.round(box.height)).toBe(12)

      const style = getComputedStyle(slab)
      // `rounded`, so a slab with corners: never `rounded-full`, which is
      // what made this read as a pill stack instead of the block's matrix.
      const radius = Number.parseFloat(style.borderTopLeftRadius)
      await expect(radius).toBeGreaterThan(0)
      await expect(radius).toBeLessThan(box.height / 2)
    }
  },
}

/**
 * Bars stand on the axis, and the ramp starts at the head of each one.
 *
 * Both halves matter. stats-14 lights from the top, which over a row of dates
 * reads as bars hanging from a ceiling; and indexing the ramp by absolute row
 * would make every short column uniformly pale, so height and colour would say
 * the same thing twice while the top of each bar drifted.
 */
export const BarsStandAndTheRampRestarts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const slabsOf = (name: RegExp) =>
      Array.from(canvas.getByRole('button', { name }).querySelectorAll('span[aria-hidden="true"]'))

    // Fri is the tallest column, Sun the shortest.
    const tall = slabsOf(/^Fri:/)
    const short = slabsOf(/^Sun:/)

    const isLit = (el: Element) => (el as HTMLElement).style.backgroundColor !== ''

    // Lit at the foot, unlit at the head: never the other way round.
    const litIndexes = tall.map((el, i) => (isLit(el) ? i : -1)).filter((i) => i >= 0)
    await expect(litIndexes.at(-1)).toBe(tall.length - 1)
    await expect(litIndexes).toEqual(
      Array.from({ length: litIndexes.length }, (_, k) => tall.length - litIndexes.length + k),
    )

    // The head of a short bar is the same full tone as the head of a tall one.
    const headOf = (slabs: Element[]) => (slabs.find(isLit) as HTMLElement).style.backgroundColor
    await expect(headOf(short)).toBe(headOf(tall))
  },
}

/**
 * The footer is totals, not a colour key.
 *
 * Every column runs one ramp, so nothing in the plot distinguishes the series
 * and a swatch beside each label would be pointing at a colour that is not
 * there. The numbers are the breakdown.
 */
export const FooterCarriesTotals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Starter across the week: 12+9+15+6+18+4+3.
    await expect(canvas.getByText('67')).toBeInTheDocument()
    // Scale: 2+4+3+1+6+0+0.
    await expect(canvas.getByText('16')).toBeInTheDocument()
  },
}

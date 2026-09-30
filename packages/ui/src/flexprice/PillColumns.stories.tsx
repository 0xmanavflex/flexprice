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
  title: 'Foundation/Flexprice/PillColumns',
  component: PillColumns,
  parameters: { layout: 'padded' },
  args: { columns, series, label: 'New subscriptions by day and plan' },
} satisfies Meta<typeof PillColumns>

export default meta
type Story = StoryObj<typeof meta>

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

/** A column whose parts are tiny still shows them — one segment, never none. */
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

/** No columns at all — the legend survives so the panel is still self-describing. */
export const NoColumns: Story = {
  args: { columns: [] },
}

/**
 * The mark is `@reui/stats-14`'s, and this is the guard that keeps it so.
 *
 * This component's first version claimed stats-14 in its provenance and drew
 * something else entirely — variable-height stacks of `rounded-full` pills,
 * bottom-anchored — and nothing caught it, because every test here asserted on
 * readings and labels rather than on the mark. A provenance note is a claim,
 * and an unchecked claim drifts.
 *
 * So these four assertions are deliberately about geometry: the slab's height
 * and radius, the 2px margin that sets the gutter, and the fact that every
 * column has the same number of slabs. If a redesign genuinely moves off the
 * block, this story should be deleted along with the provenance entry — not
 * loosened until it passes.
 */
export const MatchesTheBlocksMark: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const column = canvas
      .getByRole('button', { name: /^Mon:/ })
      .querySelectorAll('span[aria-hidden="true"]')

    // A fixed grid: the block's six slabs, present whether lit or not.
    await expect(column.length).toBe(6)

    for (const slab of Array.from(column)) {
      const box = slab.getBoundingClientRect()
      // `h-3` — 12px, not an elastic share of the column.
      await expect(Math.round(box.height)).toBe(12)

      const style = getComputedStyle(slab)
      // `rounded`, so a slab with corners — never `rounded-full`, which is
      // what made this read as a pill stack instead of the block's matrix.
      const radius = Number.parseFloat(style.borderTopLeftRadius)
      await expect(radius).toBeGreaterThan(0)
      await expect(radius).toBeLessThan(box.height / 2)

      // `my-0.5`, the block's 2px, giving a 4px gutter between slabs.
      await expect(style.marginTop).toBe('2px')
      await expect(style.marginBottom).toBe('2px')
    }
  },
}

/**
 * One series is the block's own case, so it gets the block's own ramp.
 *
 * With nothing else carrying identity there is no legend to draw — the panel
 * title already names the single series — and the graduation is magnitude,
 * which is what a sequential ramp is for.
 */
export const SingleSeriesUsesTheRamp: Story = {
  args: {
    series: [{ id: 'all', label: 'New subscriptions' }],
    columns: columns.map((column) => ({
      label: column.label,
      values: { all: Object.values(column.values).reduce((sum, value) => sum + value, 0) },
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // No legend: one colour mapping to one label would be noise.
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()

    const lit = Array.from(
      canvas.getByRole('button', { name: /^Fri:/ }).querySelectorAll('span[style*="background"]'),
    )
    // Stepped, not flat — adjacent lit slabs differ, which is the ramp.
    await expect(lit.length).toBeGreaterThan(1)
    const colours = new Set(lit.map((slab) => getComputedStyle(slab).backgroundColor))
    await expect(colours.size).toBe(lit.length)
  },
}

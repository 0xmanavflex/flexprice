import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ArcGauge } from './ArcGauge'

const meta = {
  title: 'Foundation/Flexprice/ArcGauge',
  component: ArcGauge,
  parameters: { layout: 'padded' },
  args: {
    value: 36,
    max: 40,
    caption: 'API keys active',
    label: 'API key health',
  },
  decorators: [
    (Story) => (
      <div className="bg-card mx-auto w-fit rounded-xl border p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArcGauge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * The reading is text, not only a shape — and it is announced once, not twice:
 * the figure under the arc is `aria-hidden` because the gauge's own accessible
 * name already carries it.
 */
export const ReadingIsText: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: 'API key health: 90% (36 of 40)' }),
    ).toBeInTheDocument()
    await expect(canvas.getByText('90%')).toBeInTheDocument()
  },
}

/**
 * The page decides when a reading is bad, not the gauge. A component that
 * thresholded on its own would be wrong on the first metric with a different
 * idea of "healthy".
 */
export const Warning: Story = {
  args: { value: 22, max: 40, tone: 'warning', caption: 'Keys nearing expiry' },
}

export const Critical: Story = {
  args: { value: 6, max: 40, tone: 'critical', caption: 'Keys active' },
}

/** A pre-formatted figure, when a percentage is not the thing being shown. */
export const CustomDisplay: Story = {
  args: {
    value: 62_000,
    max: 120_000,
    display: '$62.0k',
    caption: 'of a $120.0k commitment',
    tone: 'series-1',
    label: 'Commitment drawn down',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('$62.0k')).toBeInTheDocument()
  },
}

/** Full sweep. */
export const Full: Story = {
  args: { value: 40, max: 40 },
}

/** Nothing yet: a bare track and an honest zero, with no tick lit by rounding. */
export const Zero: Story = {
  args: { value: 0, max: 40, caption: 'No keys created yet' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('button', { name: 'API key health: 0% (0 of 40)' }),
    ).toBeInTheDocument()
    await expect(canvas.getByText('0%')).toBeInTheDocument()
  },
}

/** No denominator at all — clamps to empty rather than dividing by zero. */
export const NoCeiling: Story = {
  args: { value: 0, max: 0, caption: 'Nothing measured' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/NaN/)).not.toBeInTheDocument()
  },
}

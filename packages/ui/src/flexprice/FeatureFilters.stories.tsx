import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { FeatureStatus, FeatureType } from '@fp/domain'
import { FeatureFilters } from './FeatureFilters'

/**
 * The feature list's advanced filter, over `@reui/filters`. Controlled from the
 * query — the tree is rebuilt from `types` and `statuses` each render — and a
 * flat `{ types, statuses }` comes back out. No provider, no network.
 */
const meta = {
  title: 'Surfaces/FeatureFilters',
  component: FeatureFilters,
  parameters: { layout: 'padded' },
  args: { types: [], statuses: [], onChange: fn() },
} satisfies Meta<typeof FeatureFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** The chips reflect the query it was handed. */
export const WithSelection: Story = {
  args: {
    types: [FeatureType.Metered, FeatureType.Boolean],
    statuses: [FeatureStatus.Published],
  },
}

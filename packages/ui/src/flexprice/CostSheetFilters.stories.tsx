import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CostSheetStatus } from '@fp/domain'
import { CostSheetFilters } from './CostSheetFilters'

/**
 * The cost sheet list's advanced filter, over `@reui/filters`. Controlled from
 * the status array; a change reports the selected statuses back. No provider,
 * no network — a `fn()` handler so the interaction is inspectable.
 */
const meta = {
  title: 'Surfaces/CostSheetFilters',
  component: CostSheetFilters,
  parameters: { layout: 'padded' },
  args: { statuses: [], onStatusesChange: fn() },
} satisfies Meta<typeof CostSheetFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** A status already applied renders as a chip in the bar. */
export const WithStatus: Story = {
  args: { statuses: [CostSheetStatus.Archived] },
}

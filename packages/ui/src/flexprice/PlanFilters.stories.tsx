import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { PlanStatus } from '@fp/domain'
import { PlanFilters } from './PlanFilters'

/**
 * The plan list's filter, over `@reui/filters`. Controlled from the query so
 * the chips always reflect the URL; the selected statuses come back out. No
 * provider, no network.
 */
const meta = {
  title: 'Surfaces/PlanFilters',
  component: PlanFilters,
  parameters: { layout: 'padded' },
  args: { statuses: [], onStatusesChange: fn() },
} satisfies Meta<typeof PlanFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** The chips reflect the query it was handed. */
export const WithSelection: Story = {
  args: { statuses: [PlanStatus.Published] },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { InvoiceStatus } from '@fp/domain'
import { InvoiceFilters } from './InvoiceFilters'

/**
 * The invoice list's filter, over `@reui/filters`. Controlled from the query so
 * the chips always reflect the URL; the selected statuses come back out. No
 * provider, no network.
 */
const meta = {
  title: 'Surfaces/InvoiceFilters',
  component: InvoiceFilters,
  parameters: { layout: 'padded' },
  args: { statuses: [], onStatusesChange: fn() },
} satisfies Meta<typeof InvoiceFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** The chips reflect the query it was handed. */
export const WithSelection: Story = {
  args: { statuses: [InvoiceStatus.Open] },
}

/**
 * Skipped — the status that had no way of being reached before this control
 * existed, and the one a tenant's only invoice turned out to be in.
 */
export const Skipped: Story = {
  args: { statuses: [InvoiceStatus.Skipped] },
}

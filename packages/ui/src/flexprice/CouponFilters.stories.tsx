import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { CouponStatus } from '@fp/domain'
import { CouponFilters } from './CouponFilters'

/**
 * The coupon list's advanced filter, over `@reui/filters`. Controlled from the
 * status array; a change reports the selected statuses back. No provider, no
 * network — a `fn()` handler so the interaction is inspectable.
 */
const meta = {
  title: 'Surfaces/CouponFilters',
  component: CouponFilters,
  parameters: { layout: 'padded' },
  args: { statuses: [], onStatusesChange: fn() },
} satisfies Meta<typeof CouponFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /filter/i })).toBeInTheDocument()
  },
}

/** A status already applied renders as a chip in the bar. */
export const WithStatus: Story = {
  args: { statuses: [CouponStatus.Published] },
}

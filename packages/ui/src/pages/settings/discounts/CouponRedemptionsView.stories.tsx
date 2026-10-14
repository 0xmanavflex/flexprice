import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CouponRedemptionsView, type CouponRedemption } from './CouponRedemptionsView'

const CUSTOMERS = ['Acme Robotics', 'Globex AI', 'Initech Cloud', 'Hooli', 'Umbrella', 'Soylent']
const PLANS = ['Starter', 'Pro', 'Team', 'Scale']
const DATES = ['Jan 10, 2026', 'Feb 11, 2026', 'Mar 12, 2026', 'Apr 13, 2026']

/** Deterministic rows: the same count always gives the same table. */
function makeRedemptions(count: number): CouponRedemption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `red_${i + 1}`,
    customer: `${CUSTOMERS[i % CUSTOMERS.length]}${i >= CUSTOMERS.length ? ` ${Math.floor(i / CUSTOMERS.length) + 1}` : ''}`,
    plan: PLANS[i % PLANS.length] ?? 'Starter',
    appliedAt: DATES[i % DATES.length] ?? 'Jan 10, 2026',
    contractId: `subs_${i + 1}`,
    status: i % 4 === 3 ? 'Ended' : 'Active',
  }))
}

const meta = {
  title: 'App/Settings/Discounts/Discount redemptions',
  component: CouponRedemptionsView,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CouponRedemptionsView>

export default meta
type Story = StoryObj<typeof meta>

/** Drag rows from 0 to 50: the empty state, a short list, then paging. */
export const Playground: StoryObj<{ rows: number }> = {
  args: { rows: 8 },
  argTypes: { rows: { control: { type: 'range', min: 0, max: 50, step: 1 } } },
  render: ({ rows }) => <CouponRedemptionsView redemptions={makeRedemptions(rows)} />,
}

/** Still loading: the tab says so instead of listing sample rows. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading where this coupon is applied')).toBeInTheDocument()
    await expect(canvas.queryByText('Acme Robotics')).toBeNull()
  },
}

/** Real rows, once a source exists. */
export const WithRows: Story = {
  args: { redemptions: makeRedemptions(3) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Acme Robotics')).toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: { redemptions: [] },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('This coupon has not been redeemed yet.'),
    ).toBeInTheDocument()
  },
}

export const LongList: Story = { args: { redemptions: makeRedemptions(40) } }

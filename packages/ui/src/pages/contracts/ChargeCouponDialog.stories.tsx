import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { ChargeCouponDialog } from './ChargeCouponDialog'

const COUPONS = [
  { value: 'cpn_launch', label: 'Launch', discount: '20%' },
  { value: 'cpn_loyal', label: 'Loyalty', discount: '$50' },
]

/** One coupon on one charge of a new contract, from that charge's menu. */
const meta = {
  title: 'App/Contracts/Charge coupon dialog',
  component: ChargeCouponDialog,
  args: {
    charge: { priceId: 'price_api', name: 'API calls' },
    couponId: undefined,
    coupons: COUPONS,
    onClose: fn(),
    onSave: fn(),
  },
} satisfies Meta<typeof ChargeCouponDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Apply: choose a coupon, named with what it takes off, and apply it to this charge alone. */
export const Apply: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Apply coupon · API calls' }))
    await expect(
      dialog.getByText(
        'Applies to this charge only. A discount on the whole contract is chosen under Discount.',
      ),
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Apply coupon' })).toBeDisabled()
    await expect(dialog.queryByRole('button', { name: 'Remove coupon' })).toBeNull()
    await userEvent.click(dialog.getByRole('combobox', { name: 'Coupon' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Launch · 20% off' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Apply coupon' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith('cpn_launch'))
  },
}

/** Change: the charge already has a coupon; save another, or remove it. */
export const Change: Story = {
  args: { couponId: 'cpn_launch' },
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Change coupon · API calls' }))
    await expect(dialog.getByRole('combobox', { name: 'Coupon' })).toHaveTextContent(
      'Launch · 20% off',
    )
    await expect(dialog.getByRole('button', { name: 'Save coupon' })).toBeEnabled()
    await userEvent.click(dialog.getByRole('button', { name: 'Remove coupon' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalledWith(null))
  },
}

export const Closed: Story = {
  args: { charge: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('dialog')).toBeNull()
  },
}

/** Offered on every charge, so the catalogue can be empty: it says where coupons come from. */
export const NoCouponsYet: Story = {
  args: { coupons: [] },
  play: async () => {
    const dialog = within(await screen.findByRole('dialog', { name: 'Apply coupon · API calls' }))
    await expect(dialog.getByText(/No coupons yet/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Apply coupon' })).toBeDisabled()
  },
}

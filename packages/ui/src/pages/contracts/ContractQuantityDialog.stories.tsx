import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import type { SubscriptionLine } from '@fp/domain'
import { ContractQuantityDialog } from './ContractQuantityDialog'

const LINE: SubscriptionLine = {
  id: 'li_seats',
  name: 'Seats',
  kind: 'fixed',
  quantity: '5',
  billingPeriodLabel: 'Monthly',
  amount: { amount: '20', currency: 'USD' },
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: null,
  source: 'contract',
  priceId: 'price_seats',
  amountEditable: true,
  pricing: null,
  charge: null,
  overridesPriceId: '',
}

/** This month is the billing period, so the calendar opens on it. */
const now = new Date()
const PERIOD = {
  start: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)),
  end: new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1)),
}
const MONTH = now.toLocaleString('en-US', { month: 'long' })
const FIFTEENTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`

const meta = {
  title: 'App/Contracts/Contract quantity dialog',
  component: ContractQuantityDialog,
  parameters: {
    layout: 'fullscreen',
    // Base UI focus guards and the vendored calendar popover: see DateInput.stories.tsx.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-dialog-name', enabled: false },
        ],
      },
    },
  },
  args: {
    line: LINE,
    currency: 'USD',
    period: PERIOD,
    onClose: fn(),
    onPreview: fn(async () => ({ lines: [], invoices: [] })),
    onConfirm: fn(),
  },
} satisfies Meta<typeof ContractQuantityDialog>

export default meta
type Story = StoryObj<typeof meta>

/** The effective date is picked on the shared calendar and sent as a `YYYY-MM-DD` day. */
export const PicksTheEffectiveDay: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog'))
    const quantity = dialog.getByRole('textbox', { name: 'Quantity' })
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '8')
    await expect(dialog.getByRole('button', { name: 'Effective from' })).toHaveTextContent('Now')
    await userEvent.click(dialog.getByRole('button', { name: 'Effective from' }))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`${MONTH} 15`) }))
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))
    await expect(args.onPreview).toHaveBeenCalledWith(LINE, {
      quantity: '8',
      amount: '20',
      effectiveDate: FIFTEENTH,
    })
  },
}

/** A picked day can be cleared to apply the change now. */
export const ClearsTheEffectiveDay: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Effective from' }))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`${MONTH} 15`) }))
    await userEvent.click(dialog.getByRole('button', { name: 'Clear effective date' }))
    await expect(dialog.getByRole('button', { name: 'Effective from' })).toHaveTextContent('Now')
  },
}

/** Quantity and price both changed: the preview shows each, before and after, and the price of each line. */
export const PreviewShowsPriceAndQuantity: Story = {
  args: {
    onPreview: fn(async () => ({
      lines: [
        {
          id: 'li_seats',
          action: 'ended',
          quantity: '5',
          startDate: new Date('2026-09-30T00:00:00Z'),
          endDate: new Date('2026-10-27T00:00:00Z'),
        },
        {
          id: 'li_seats_2',
          action: 'created',
          quantity: '8',
          startDate: new Date('2026-10-27T00:00:00Z'),
          endDate: null,
        },
      ],
      invoices: [
        {
          action: 'created',
          status: 'preview',
          amountDue: { amount: '21.77', currency: 'USD' },
          walletCredit: null,
        },
      ],
    })),
  },
  play: async () => {
    const dialog = within(await screen.findByRole('dialog'))
    const quantity = dialog.getByRole('textbox', { name: 'Quantity' })
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '8')
    const price = dialog.getByRole('textbox', { name: /Price/ })
    await userEvent.clear(price)
    await userEvent.type(price, '25')
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))

    await dialog.findByText('Before')
    const [summary, lines] = dialog.getAllByRole('table')
    const quantityRow = within(within(summary!).getByText('Quantity').closest('tr')!)
    await expect(quantityRow.getByText('5')).toBeVisible()
    await expect(quantityRow.getByText('8')).toBeVisible()
    const priceRow = within(within(summary!).getByText('Price').closest('tr')!)
    await expect(priceRow.getByText('$20.00')).toBeVisible()
    await expect(priceRow.getByText('$25.00')).toBeVisible()
    // Each line carries its own price: the old one ended, the new one started.
    const ended = within(within(lines!).getByText('Ended').closest('tr')!)
    await expect(ended.getByText('$20.00')).toBeVisible()
    const started = within(within(lines!).getByText('New line').closest('tr')!)
    await expect(started.getByText('$25.00')).toBeVisible()
    await expect(started.getByText(/Ongoing/)).toBeVisible()
    await expect(dialog.getByText('$21.77')).toBeVisible()
  },
}

/** A cut credits the wallet: the preview names it as a wallet credit, with its amount, not as an invoice. */
export const PreviewShowsWalletCredit: Story = {
  args: {
    onPreview: fn(async () => ({
      lines: [
        {
          id: 'li_seats',
          action: 'ended',
          quantity: '5',
          startDate: new Date('2026-09-30T00:00:00Z'),
          endDate: new Date('2026-10-27T00:00:00Z'),
        },
      ],
      invoices: [
        {
          action: 'wallet_credit',
          status: 'completed',
          amountDue: null,
          walletCredit: { amount: '1.65', currency: 'USD' },
        },
      ],
    })),
  },
  play: async () => {
    const dialog = within(await screen.findByRole('dialog'))
    const quantity = dialog.getByRole('textbox', { name: 'Quantity' })
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '0')
    await userEvent.click(dialog.getByRole('button', { name: 'Preview change' }))

    const credit = await dialog.findByText('Credit to wallet')
    await expect(within(credit.closest('li')!).getByText('$1.65')).toBeVisible()
    await expect(dialog.queryByText(/Credit to wallet invoice/)).toBeNull()
  },
}

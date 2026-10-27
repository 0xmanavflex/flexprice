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

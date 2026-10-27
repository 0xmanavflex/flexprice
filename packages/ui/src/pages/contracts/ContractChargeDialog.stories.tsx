import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
import type { SubscriptionLine } from '@fp/domain'
import { ContractChargeDialog } from './ContractChargeDialog'

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

/** The 15th of the month the calendar opens on (this month), and its accessible name. */
const now = new Date()
const MONTH = now.toLocaleString('en-US', { month: 'long' })
const FIFTEENTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`

const meta = {
  title: 'App/Contracts/Contract charge dialog',
  component: ContractChargeDialog,
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
    state: { mode: 'end', line: LINE },
    onClose: fn(),
    currency: 'USD',
    onAdd: fn(),
    onEdit: fn(),
    onEnd: fn(),
  },
} satisfies Meta<typeof ContractChargeDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Ending a charge: no date ends it now. */
export const EndsNow: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog'))
    await expect(dialog.getByRole('button', { name: 'Ends on' })).toHaveTextContent('Now')
    await userEvent.click(dialog.getByRole('button', { name: 'End charge' }))
    await expect(args.onEnd).toHaveBeenCalledWith(LINE, { effectiveFrom: '' })
  },
}

/** The end date is picked on the shared calendar, not the browser's, and sent as a day. */
export const EndsOnADay: Story = {
  play: async ({ args }) => {
    const dialog = within(await screen.findByRole('dialog'))
    await userEvent.click(dialog.getByRole('button', { name: 'Ends on' }))
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`${MONTH} 15`) }))
    await expect(dialog.getByRole('button', { name: 'Ends on' })).not.toHaveTextContent('Now')
    await userEvent.click(dialog.getByRole('button', { name: 'End charge' }))
    await expect(args.onEnd).toHaveBeenCalledWith(LINE, { effectiveFrom: FIFTEENTH })
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test'
import { PaymentStatus, manualPaymentStatusChoices, money } from '@fp/domain'
import { PaymentStatusDialog } from './PaymentStatusDialog'

/** Set an invoice's payment status by hand: where it is now, and where it may go. */
const meta = {
  title: 'App/Billing/Invoices/Payment status dialog',
  component: PaymentStatusDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn(),
    current: PaymentStatus.Pending,
    choices: manualPaymentStatusChoices(PaymentStatus.Pending),
    amountDue: money('500.00', 'USD'),
    amountPaid: money('0', 'USD'),
    amountRemaining: money('500.00', 'USD'),
  },
} satisfies Meta<typeof PaymentStatusDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Opens on what the invoice says now, and offers the first real change. */
export const ShowsTheInvoiceAsItIs: Story = {
  play: async ({ args }) => {
    const dialog = await screen.findByRole('dialog')
    await expect(dialog).toHaveTextContent('Pending')
    await expect(dialog).toHaveTextContent('$500.00')
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({ status: PaymentStatus.Succeeded }),
    )
  },
}

/** Pending records how much has been paid so far. */
export const RecordsAPartialAmount: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('radio', { name: /pending \(current\)/i }))
    await userEvent.type(screen.getByLabelText('Amount paid so far'), '120')
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({ status: PaymentStatus.Pending, amount: '120' }),
    )
  },
}

/** More than is due is refused before it is sent. */
export const RefusesMoreThanDue: Story = {
  play: async ({ args }) => {
    await userEvent.click(await screen.findByRole('radio', { name: /pending \(current\)/i }))
    await userEvent.type(screen.getByLabelText('Amount paid so far'), '900')
    await userEvent.click(screen.getByRole('button', { name: 'Update status' }))
    await expect(await screen.findByRole('alert')).toHaveTextContent('cannot be more than')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A paid invoice can only become overpaid. */
export const FromSucceeded: Story = {
  args: {
    current: PaymentStatus.Succeeded,
    choices: manualPaymentStatusChoices(PaymentStatus.Succeeded),
    amountPaid: money('500.00', 'USD'),
    amountRemaining: money('0', 'USD'),
  },
  play: async () => {
    await expect(await screen.findByRole('radio', { name: /overpaid/i })).toBeInTheDocument()
    await expect(screen.queryByRole('radio', { name: /^failed/i })).toBeNull()
  },
}

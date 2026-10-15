import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import { InvoiceStatus, PaymentStatus, manualPaymentStatusChoices, money } from '@fp/domain'
import { InvoiceEditView, type EditableInvoice } from './InvoiceEditView'

const draft: EditableInvoice = {
  number: 'INV-0042',
  customerName: 'Acme Robotics',
  status: InvoiceStatus.Draft,
  paymentStatus: PaymentStatus.Pending,
  total: money('120.00', 'USD'),
  amountDue: money('120.00', 'USD'),
  amountPaid: money('0', 'USD'),
  amountRemaining: money('120.00', 'USD'),
  dueDate: '2099-01-31',
  metadata: { po: 'PO-7' },
  lines: [
    {
      id: 'li_1',
      displayName: 'Platform fee',
      amount: '100.00',
      quantity: '1',
      description: '',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    },
    { id: 'li_2', displayName: 'API calls', amount: '20.00', quantity: '2000', description: '' },
  ],
}

/** The whole invoice, editable: status, payment, due date, discount, lines and metadata. */
const meta = {
  title: 'App/Billing/Invoices/Invoice edit',
  component: InvoiceEditView,
  parameters: { layout: 'padded' },
  args: {
    invoice: draft,
    paymentChoices: manualPaymentStatusChoices(PaymentStatus.Pending),
    paymentStatusBlocked: null,
    onSave: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof InvoiceEditView>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing to save until something changes; a line edit and a new metadata key save together. */
export const EditsADraft: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Save changes' })
    await expect(save).toBeDisabled()
    const amounts = canvas
      .getAllByRole('textbox')
      .filter((el) => (el as HTMLInputElement).value === '20.00')
    await userEvent.clear(amounts[0]!)
    await userEvent.type(amounts[0]!, '25.00')
    await userEvent.click(canvas.getByRole('button', { name: 'Add key' }))
    const keys = canvas.getAllByLabelText('Metadata key')
    await userEvent.type(keys[keys.length - 1]!, 'region')
    await userEvent.click(save)
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { po: 'PO-7', region: '' },
          lines: expect.arrayContaining([expect.objectContaining({ id: 'li_2', amount: '25.00' })]),
          nextStatus: 'keep',
        }),
      ),
    )
  },
}

/** A finalized invoice's line change voids it into a draft copy, so it asks first. */
export const ConfirmsReplacingAFinalizedInvoice: Story = {
  args: { invoice: { ...draft, status: InvoiceStatus.Open } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This invoice is finalized')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Remove API calls' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await screen.findByText('Replace this invoice with a draft?')).toBeInTheDocument()
    await expect(args.onSave).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Void and create draft' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalled())
  },
}

/** A line needs a name and an amount before anything is sent. */
export const ValidatesLines: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add line' }))
    const names = canvas.getAllByPlaceholderText('What this line charges for')
    await userEvent.type(names[names.length - 1]!, 'Setup')
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Enter an amount for “Setup”')
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

/** Recorded payments set the status, so it is shown and not offered. */
export const PaymentStatusLocked: Story = {
  args: { paymentStatusBlocked: 'Recorded payments set the status' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/recorded payments set the status/i),
    ).toBeInTheDocument()
  },
}

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import {
  type CreateInvoice,
  InvoiceStatus,
  PaymentStatus,
  emptyInvoice,
  manualPaymentStatusChoices,
  money,
} from '@fp/domain'
import {
  InvoiceForm,
  type EditableInvoice,
  type InvoiceCreateProps,
  type InvoiceCustomerOption,
  type InvoiceEditProps,
} from './InvoiceForm'

const customers: InvoiceCustomerOption[] = [
  { id: 'cus_1', name: 'Acme Corp', email: 'billing@acme.example' },
  { id: 'cus_2', name: 'Globex', email: 'ap@globex.example' },
]

const billFrom = {
  name: 'Northwind Systems',
  email: 'billing@northwind.example',
  address: ['180 Harbourside Way', 'Portland, OR 97205', 'US'],
}
const billTo = {
  name: 'Acme Corp',
  email: 'billing@acme.example',
  address: ['1 Infinite Loop', 'Cupertino, CA 95014', 'US'],
}

const prefilled: CreateInvoice = {
  ...emptyInvoice(),
  customerId: 'cus_1',
  currency: 'USD',
  dueDate: '2099-01-31',
  lines: [
    {
      description: 'Onboarding',
      quantity: '2',
      amount: '300',
      note: 'Two sessions',
      periodStart: '',
      periodEnd: '',
    },
  ],
}

const existing: EditableInvoice = {
  number: 'INV-0042',
  customerName: 'Acme Corp',
  status: InvoiceStatus.Draft,
  paymentStatus: PaymentStatus.Pending,
  currency: 'USD',
  issueDate: '2026-10-01',
  dueDate: '2099-01-31',
  description: 'October services',
  amountDue: money('120.00', 'USD'),
  amountPaid: money('0', 'USD'),
  amountRemaining: money('120.00', 'USD'),
  tax: money('0', 'USD'),
  total: money('120.00', 'USD'),
  metadata: { po: 'PO-7' },
  lines: [
    { id: 'li_1', displayName: 'Platform fee', amount: '100.00', quantity: '1', description: '' },
    { id: 'li_2', displayName: 'API calls', amount: '20.00', quantity: '2000', description: '' },
  ],
}

const withHeight: Decorator = (Story) => (
  <div className="flex h-[1100px] flex-col">
    <Story />
  </div>
)

/** One invoice form for create and edit, on V1's layout with only the fields the API takes. */
const meta = {
  title: 'App/Billing/Invoices/Invoice form',
  component: InvoiceForm,
  decorators: [withHeight],
  parameters: {
    layout: 'fullscreen',
    // The combobox's chevron button is unlabelled in the primitive; fix there, not here.
    a11y: { config: { rules: [{ id: 'button-name', enabled: false }] } },
  },
} satisfies Meta<typeof InvoiceForm>

export default meta

type CreateStory = StoryObj<InvoiceCreateProps>
type EditStory = StoryObj<InvoiceEditProps>

const createArgs: InvoiceCreateProps = {
  trail: [{ label: 'Invoices' }, { label: 'New invoice' }],
  customers,
  billFrom,
  billTo: null,
  taxRates: [{ code: 'GST18', name: 'GST', percentage: '18' }],
  onSubmit: fn(),
  onCancel: fn(),
}

const editArgs: InvoiceEditProps = {
  mode: 'edit',
  trail: [{ label: 'Invoices' }, { label: 'INV-0042' }, { label: 'Edit' }],
  invoice: existing,
  billFrom,
  billTo,
  paymentChoices: manualPaymentStatusChoices(PaymentStatus.Pending),
  paymentStatusBlocked: null,
  onSave: fn(),
  onCancel: fn(),
}

/** A new invoice: V1's sections, with a customer still to choose. */
export const Create: CreateStory = {
  args: createArgs,
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'New invoice' })).toBeInTheDocument()
    for (const section of ['Customer', 'Dates and currency', 'Line items', 'Taxes', 'Notes']) {
      await expect(canvas.getByText(section, { selector: 'h3, h2, span, p, div' })).toBeTruthy()
    }
    await expect(canvas.getByText('Northwind Systems')).toBeInTheDocument()
  },
}

/** A customer is required before anything is sent. */
export const RequiresACustomer: CreateStory = {
  args: createArgs,
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /finalize invoice/i }))
    await expect(await canvas.findByText('Choose a customer')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Quantity × unit price is the line amount, and the customer's taxes go with it. */
export const SavesAPrefilledDraft: CreateStory = {
  args: {
    ...createArgs,
    billTo,
    defaultValue: prefilled,
    customerTaxes: [
      {
        taxRateCode: 'VAT20',
        name: 'VAT',
        percentage: '20',
        taxBehavior: 'exclusive',
        priority: 1,
        autoApply: true,
      },
    ],
  },
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('VAT · 20%')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_1',
          finalize: false,
          total: '300.00',
          taxes: [expect.objectContaining({ taxRateCode: 'VAT20' })],
          lines: [
            expect.objectContaining({
              description: 'Onboarding',
              amount: '300',
              note: 'Two sessions',
            }),
          ],
        }),
      ),
    )
  },
}

/**
 * Each tax can be set inclusive or exclusive, given its own priority and auto-apply, as in V1:
 * a 2% inclusive rate first, then a 5% exclusive one.
 */
export const SetsTaxOverrides: CreateStory = {
  args: {
    ...createArgs,
    billTo,
    defaultValue: prefilled,
    customerTaxes: [
      {
        taxRateCode: 'LOCAL2',
        name: 'Local',
        percentage: '2',
        taxBehavior: 'exclusive',
        priority: 1,
        autoApply: true,
      },
      {
        taxRateCode: 'STATE5',
        name: 'State',
        percentage: '5',
        taxBehavior: 'exclusive',
        priority: 2,
        autoApply: true,
      },
    ],
  },
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('combobox', { name: 'Local tax behaviour' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Inclusive' }))
    const priority = canvas.getByRole('spinbutton', { name: 'State priority' })
    await userEvent.clear(priority)
    await userEvent.type(priority, '75')
    await userEvent.click(canvas.getByRole('switch', { name: 'Auto-apply for State' }))
    await userEvent.click(canvas.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          taxes: [
            expect.objectContaining({
              taxRateCode: 'LOCAL2',
              taxBehavior: 'inclusive',
              priority: 1,
              autoApply: true,
            }),
            expect.objectContaining({
              taxRateCode: 'STATE5',
              taxBehavior: 'exclusive',
              priority: 75,
              autoApply: false,
            }),
          ],
        }),
      ),
    )
  },
}

/** A server refusal is shown above the summary. */
export const WithServerError: CreateStory = {
  args: { ...createArgs, defaultValue: prefilled, submitError: 'Invoice number already exists.' },
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Invoice number already exists.'),
    ).toBeInTheDocument()
  },
}

/** Editing uses the same form: the header, sections and summary match the create page. */
export const Edit: EditStory = {
  args: editArgs,
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Edit INV-0042' })).toBeInTheDocument()
    await expect(canvas.getByText('Status and payment')).toBeInTheDocument()
    const save = canvas.getByRole('button', { name: 'Save changes' })
    await expect(save).toBeDisabled()
    await userEvent.clear(canvas.getByLabelText('Unit price for line 2'))
    await userEvent.type(canvas.getByLabelText('Unit price for line 2'), '0.02')
    await userEvent.click(save)
    await waitFor(() =>
      expect(args.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: expect.arrayContaining([
            expect.objectContaining({ id: 'li_2', amount: '40', quantity: '2000' }),
          ]),
        }),
      ),
    )
  },
}

/** A finalized invoice's line change voids it into a draft copy, so it asks first. */
export const EditFinalized: EditStory = {
  args: { ...editArgs, invoice: { ...existing, status: InvoiceStatus.Open } },
  render: (args) => <InvoiceForm {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('This invoice is finalized')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Remove line 2' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(await screen.findByText('Replace this invoice with a draft?')).toBeInTheDocument()
    await expect(args.onSave).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Void and create draft' }))
    await waitFor(() => expect(args.onSave).toHaveBeenCalled())
  },
}

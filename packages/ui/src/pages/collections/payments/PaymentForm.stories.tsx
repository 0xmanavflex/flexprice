import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { RecordPayment } from '@fp/domain'
import { PaymentForm, type PaymentFormProps } from './PaymentForm'

const trail = [{ label: 'Payments' }, { label: 'Record payment' }]

function makeInvoices(count: number): PaymentFormProps['invoices'] {
  return Array.from({ length: count }, (_, index) => ({
    value: `inv_${index + 1}`,
    label: `INV-${1041 + index}`,
  }))
}

const PREFILLED: RecordPayment = {
  invoiceId: 'inv_1',
  currency: 'USD',
  amount: '120.50',
  methodType: 'CARD',
  processNow: false,
}

/** Drives the ReUI Select combobox; its options render in a portal. */
async function chooseOption(label: RegExp, optionName: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }))
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

/** Record a payment against an invoice, on the same full-page shell as the other create forms. */
const meta = {
  title: 'App/Collections/Payments/Payment form',
  component: PaymentForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    invoices: makeInvoices(5),
    trail,
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof PaymentForm>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  invoiceCount: number
  prefilled: boolean
  isSubmitting: boolean
  submitError: string
  onSubmit: (payment: RecordPayment) => void
  onCancel: () => void
}

/** Remounts when `prefilled` flips, because react-hook-form reads its defaults once. */
function PaymentFormPlayground({
  invoiceCount,
  prefilled,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: PlaygroundArgs) {
  return (
    <PaymentForm
      key={String(prefilled)}
      invoices={makeInvoices(invoiceCount)}
      trail={trail}
      {...(prefilled ? { defaultValue: PREFILLED } : {})}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitError={submitError || null}
    />
  )
}

/** Drag the invoice count, prefill the draft, lock the form or show a server error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  argTypes: {
    invoiceCount: { control: { type: 'number', min: 0, max: 50, step: 1 } },
    prefilled: { control: 'boolean' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
  args: {
    invoiceCount: 5,
    prefilled: false,
    isSubmitting: false,
    submitError: '',
    onSubmit: fn(),
    onCancel: fn(),
  },
  render: (args) => <PaymentFormPlayground {...args} />,
}

/** Form fields are not logins: password managers are told to leave them alone. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const amount = within(canvasElement).getByRole('textbox', { name: /^Amount/ })
    await expect(amount).toHaveAttribute('autocomplete', 'off')
    await expect(amount).toHaveAttribute('data-1p-ignore')
  },
}

/** Submitting an empty form is rejected by the domain schema. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create payment' }))
    // The select placeholder and the validation message share this text, so wait for both.
    await waitFor(() => expect(canvas.getAllByText('Choose an invoice')).toHaveLength(2))
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A complete payment reaches `onSubmit` with the typed amount. */
export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseOption(/^Invoice/, 'INV-1042')
    await chooseOption(/^Currency/, 'EUR')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Amount/ }), '75.25')
    await userEvent.click(canvas.getByRole('button', { name: 'Create payment' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceId: 'inv_2', currency: 'EUR', amount: '75.25' }),
      ),
    )
  },
}

/** With a provider connected, a payment can be raised as a link the customer pays online. */
export const PaymentLink: Story = {
  args: {
    defaultValue: { ...PREFILLED, methodType: 'OFFLINE' },
    gateways: [
      { value: 'stripe', label: 'Stripe' },
      { value: 'razorpay', label: 'Razorpay' },
    ],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await chooseOption(/^Method/, 'Payment link (paid online)')
    // Nothing is left initiated: the link is raised at once.
    await expect(canvas.queryByRole('switch', { name: /^Process now/ })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Create payment' }))
    await expect(await canvas.findByText('Choose the payment provider')).toBeVisible()
    await chooseOption(/^Provider/, 'Razorpay')
    await userEvent.click(canvas.getByRole('button', { name: 'Create payment' }))
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ methodType: 'PAYMENT_LINK', gateway: 'razorpay' }),
      ),
    )
  },
}

/** No provider connected: the method is not offered. */
export const NoPaymentLinkWithoutProvider: Story = {
  play: async () => {
    await userEvent.click(screen.getByRole('combobox', { name: /^Method/ }))
    await expect(await screen.findByRole('option', { name: /^Offline/ })).toBeVisible()
    await expect(screen.queryByRole('option', { name: /^Payment link/ })).toBeNull()
  },
}

export const Prefilled: Story = {
  args: { defaultValue: PREFILLED },
}

export const Submitting: Story = {
  args: { defaultValue: PREFILLED, isSubmitting: true },
}

export const WithServerError: Story = {
  args: { defaultValue: PREFILLED, submitError: 'The invoice is already paid in full.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('The invoice is already paid in full.'),
    ).toBeInTheDocument()
  },
}

export const NoInvoices: Story = {
  args: { invoices: [] },
}

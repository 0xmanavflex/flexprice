import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { defaultInvoiceConfig, entityInvoicePreview } from '@fp/domain'
import { BillingEntityForm } from './BillingEntityForm'

const meta = {
  title: 'App/Settings/Billing entities/Billing entity form',
  component: BillingEntityForm,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-[720px] flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    mode: 'create',
    trail: [{ label: 'Billing entities' }, { label: 'New entity' }],
    preview: (prefix: string) => entityInvoicePreview(defaultInvoiceConfig(), prefix),
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof BillingEntityForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create billing entity' }))
    await expect(await canvas.findByText('Enter a name.')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), ' Acme India ')
    await userEvent.type(canvas.getByRole('textbox', { name: /legal name/i }), 'Acme India Pvt Ltd')
    await userEvent.type(canvas.getByRole('textbox', { name: /invoice prefix/i }), 'ACME-IN')
    await userEvent.click(canvas.getByRole('button', { name: 'Add tax ID' }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tax ID 1 type' }), 'GSTIN')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Tax ID 1 value' }), '29ABCDE1234F1Z5')
    await userEvent.click(canvas.getByRole('button', { name: 'Create billing entity' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme India',
        invoiceNumberPrefix: 'ACME-IN',
        taxIdentifiers: [expect.objectContaining({ type: 'GSTIN', value: '29ABCDE1234F1Z5' })],
      }),
    )
  },
}

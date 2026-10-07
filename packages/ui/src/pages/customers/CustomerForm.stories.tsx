import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CustomerForm } from './CustomerForm'

/** Customer create and edit: one page, with a live profile rail on create. */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/CustomerForm',
  component: CustomerForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    mode: 'create',
    trail: [{ label: 'Customers' }, { label: 'Create customer' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CustomerForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(canvas.getByText('Enter an external ID')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.type(canvas.getByRole('textbox', { name: /external id/i }), 'acme')
    await userEvent.click(canvas.getByRole('button', { name: 'Create customer' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', externalId: 'acme' }),
    )
  },
}

export const PreviewFollowsDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rail = canvas.getByRole('complementary', { name: 'Customer preview' })
    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.type(canvas.getByRole('textbox', { name: /^email/i }), 'billing@acme.test')
    await userEvent.click(canvas.getByRole('button', { name: /More details/ }))
    await userEvent.type(canvas.getByRole('textbox', { name: /city/i }), 'London')
    await expect(within(rail).getByText('Acme Corp')).toBeInTheDocument()
    await expect(within(rail).getByText('AC')).toBeInTheDocument()
    await expect(within(rail).getByText('billing@acme.test')).toBeInTheDocument()
    await expect(within(rail).getByText('London')).toBeInTheDocument()
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    customerName: 'Acme Corp',
    trail: [{ label: 'Customers' }, { label: 'Acme Corp' }, { label: 'Edit' }],
    defaultValue: { externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('textbox', { name: /^name/i })).toHaveValue('Acme Corp')
    await expect(canvas.queryByRole('complementary')).not.toBeInTheDocument()
    await expect(canvas.getByRole('textbox', { name: /city/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Save changes' }))
    await expect(args.onSubmit).toHaveBeenCalled()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A customer with that external ID already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CustomerForm } from './CustomerForm'

/** Customer create and edit: one page, no preview rail. */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Customers/Customer form',
  component: CustomerForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    mode: 'create',
    trail: [{ label: 'Customers' }, { label: 'Create customer' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    customerName: { control: 'text', description: 'Edit page title; edit mode only.' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    defaultValue: { control: false },
    trail: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof CustomerForm>

export default meta
type Story = StoryObj<typeof meta>

/** Flip create/edit, submitting and a server error from the controls. */
export const Playground: Story = {
  args: { isSubmitting: false, submitError: '', customerName: 'Acme Corp' },
  render: ({ mode, customerName, submitError, ...args }) =>
    mode === 'edit' ? (
      <CustomerForm
        key="edit"
        {...args}
        mode="edit"
        customerName={customerName ?? 'Acme Corp'}
        trail={[{ label: 'Customers' }, { label: customerName ?? 'Acme Corp' }, { label: 'Edit' }]}
        submitError={submitError || null}
        defaultValue={{ externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' }}
      />
    ) : (
      <CustomerForm
        key="create"
        {...args}
        mode="create"
        trail={[{ label: 'Customers' }, { label: 'Create customer' }]}
        submitError={submitError || null}
      />
    ),
}

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
    await expect(canvas.queryByRole('complementary')).toBeNull()
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

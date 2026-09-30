import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CustomerEditorDialog } from './CustomerEditorDialog'

/** The customer editor, as a centred dialog — the list stays visible behind it. */
const meta = {
  title: 'Surfaces/CustomerEditorDialog',
  component: CustomerEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof CustomerEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New customer' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create customer/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(await screen.findByText('Enter an external ID')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^name/i }), 'Acme Corp')
    await userEvent.type(screen.getByRole('textbox', { name: /external id/i }), 'acme')
    await userEvent.click(screen.getByRole('button', { name: /create customer/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', externalId: 'acme' }),
    )
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { externalId: 'acme', name: 'Acme Corp', email: 'billing@acme.test' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit customer' })).toBeInTheDocument()
    await expect(screen.getByRole('textbox', { name: /^name/i })).toHaveValue('Acme Corp')
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A customer with that external ID already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

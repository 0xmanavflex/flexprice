import { emptyTaxRate } from '@fp/domain'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TaxRateEditorDialog } from './TaxRateEditorDialog'

/** The tax rate editor, as a centred dialog. Create takes the value and scope; edit is limited to what the API lets change. */
const meta = {
  title: 'Surfaces/TaxRateEditorDialog',
  component: TaxRateEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', defaultValue: emptyTaxRate(), onSubmit: fn() },
} satisfies Meta<typeof TaxRateEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New tax rate' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create tax rate/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^name/i }), 'VAT standard')
    await userEvent.type(screen.getByRole('textbox', { name: /^code/i }), 'VAT20')
    await userEvent.type(screen.getByRole('textbox', { name: /rate/i }), '20')
    await userEvent.click(screen.getByRole('button', { name: /create tax rate/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'VAT standard', code: 'VAT20', percentageValue: '20' }),
    )
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'VAT standard', code: 'VAT20', description: '', status: 'published' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit tax rate' })).toBeInTheDocument()
    await expect(screen.getByRole('textbox', { name: /^name/i })).toHaveValue('VAT standard')
    await expect(screen.queryByRole('textbox', { name: /rate/i })).not.toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A tax rate with that code already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

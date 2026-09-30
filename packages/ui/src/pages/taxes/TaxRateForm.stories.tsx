import { emptyTaxRate } from '@fp/domain'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TaxRateCreateForm, TaxRateEditForm } from './TaxRateForm'

/**
 * Tax rate create and edit, each a full page. Create takes the value and scope;
 * edit is limited to what the API lets change and is prepopulated.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/TaxRateForm',
  component: TaxRateCreateForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Tax rates' }, { label: 'Create tax rate' }],
    defaultValue: emptyTaxRate(),
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof TaxRateCreateForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create tax rate/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: /^name/i }), 'VAT standard')
    await userEvent.type(canvas.getByRole('textbox', { name: /^code/i }), 'VAT20')
    await userEvent.type(canvas.getByRole('textbox', { name: /rate/i }), '20')
    await userEvent.click(canvas.getByRole('button', { name: /create tax rate/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'VAT standard', code: 'VAT20', percentageValue: '20' }),
    )
  },
}

export const Edit: Story = {
  render: (args) => (
    <TaxRateEditForm
      trail={[{ label: 'Tax rates' }, { label: 'VAT standard' }, { label: 'Edit' }]}
      defaultValue={{ name: 'VAT standard', code: 'VAT20', description: '', status: 'published' }}
      onSubmit={fn()}
      {...(args.onCancel ? { onCancel: args.onCancel } : {})}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Edit tax rate' })).toBeInTheDocument()
    await expect(canvas.getByRole('textbox', { name: /^name/i })).toHaveValue('VAT standard')
    await expect(canvas.queryByRole('textbox', { name: /rate \(%\)/i })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'A tax rate with that code already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

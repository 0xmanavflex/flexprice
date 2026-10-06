import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FormToolbar } from './FormToolbar'

/**
 * The bar a create page opens with. The CTA sits outside the `<form>`, so it
 * is wired by `formId`; these stories check the label rules and that Cancel
 * and the close button both hand control back.
 */
const meta = {
  title: 'Foundation/Compositions/Form toolbar',
  component: FormToolbar,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Create group',
    mode: 'create',
    noun: 'group',
    formId: 'demo-form',
    onCancel: fn(),
  },
} satisfies Meta<typeof FormToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Create group' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Create group' })).toHaveAttribute(
      'form',
      'demo-form',
    )
  },
}

export const Edit: Story = {
  args: { title: 'Edit Acme', mode: 'edit' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Save changes' })).toBeVisible()
  },
}

export const CancelAndCloseReturn: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Close form' }))
    await expect(args.onCancel).toHaveBeenCalledTimes(2)
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  },
}

export const WithoutWayBack: Story = {
  render: ({ onCancel: _onCancel, ...args }) => <FormToolbar {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Cancel' })).toBeNull()
  },
}

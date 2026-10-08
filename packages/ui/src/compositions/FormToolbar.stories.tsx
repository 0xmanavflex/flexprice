import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { FormToolbar } from './FormToolbar'

/**
 * The bar a create page opens with. The CTA sits outside the `<form>`, so it
 * is wired by `formId`; these stories check the label rules, that the close
 * button hands control back, and the Previous/Next of a staged form.
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

export const CloseReturns: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Close form' }))
    await expect(args.onCancel).toHaveBeenCalledTimes(1)
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Close form' })).toBeDisabled()
  },
}

/** A middle step of a staged form: Previous and Next, no Create. */
export const MiddleStep: Story = {
  args: { hideSubmit: true, onPrevious: fn(), onNext: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Create group' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(args.onPrevious).toHaveBeenCalledTimes(1)
    await expect(args.onNext).toHaveBeenCalledTimes(1)
  },
}

export const WithoutWayBack: Story = {
  render: ({ onCancel: _onCancel, ...args }) => <FormToolbar {...args} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Close form' })).toBeNull()
  },
}

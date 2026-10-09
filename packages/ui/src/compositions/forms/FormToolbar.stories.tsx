import type { ComponentProps } from 'react'
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
  argTypes: {
    title: { control: 'text' },
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    noun: { control: 'text', description: 'Names the create label: "Create group".' },
    formId: { control: 'text', description: 'The `id` of the `<form>` the CTA submits.' },
    isSubmitting: { control: 'boolean' },
    submitLabel: { control: 'text', description: 'Overrides the derived label.' },
    hideSubmit: { control: 'boolean', description: 'Earlier steps of a multi-step form.' },
    onCancel: { control: false },
    center: { control: false },
  },
} satisfies Meta<typeof FormToolbar>

export default meta
type Story = StoryObj<typeof meta>

type PlaygroundArgs = ComponentProps<typeof FormToolbar> & { hasWayBack: boolean }

/** Switch create/edit, set the noun or a custom label, submit, hide the CTA, or remove the way back. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Create group',
    mode: 'create',
    noun: 'group',
    formId: 'demo-form',
    isSubmitting: false,
    hideSubmit: false,
    hasWayBack: true,
    onCancel: fn(),
  },
  argTypes: {
    hasWayBack: { control: 'boolean', description: 'Off drops Cancel and the close button.' },
  },
  render: ({ hasWayBack, onCancel, ...args }) => (
    <FormToolbar {...args} onCancel={hasWayBack ? onCancel : undefined} />
  ),
}

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

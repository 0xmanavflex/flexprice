import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GroupEditorDialog } from './GroupEditorDialog'

/** The group create dialog. Groups have no update route, so there is no edit mode. */
const meta = {
  title: 'Surfaces/GroupEditorDialog',
  component: GroupEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof GroupEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New group' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create group/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^name/i }), 'Compute')
    await userEvent.type(screen.getByRole('textbox', { name: /lookup key/i }), 'compute')
    await userEvent.click(screen.getByRole('button', { name: /create group/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Compute', lookupKey: 'compute', entityType: 'feature' }),
    )
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A group with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CostSheetEditorDialog } from './CostSheetEditorDialog'

/**
 * The cost sheet editor, as a centred dialog — the list stays visible behind
 * it. Open by default so the surface is visible.
 */
const meta = {
  title: 'Surfaces/CostSheetEditorDialog',
  component: CostSheetEditorDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), mode: 'create', onSubmit: fn() },
} satisfies Meta<typeof CostSheetEditorDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A name is required; a valid draft submits. */
export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'New cost sheet' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create cost sheet/i }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /^name/i }), 'GPU inference')
    await userEvent.click(screen.getByRole('button', { name: /create cost sheet/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GPU inference' }),
    )
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'GPU inference', lookupKey: 'gpu', description: 'Per-token GPU cost' },
  },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('heading', { name: 'Edit cost sheet' })).toBeInTheDocument()
    await expect(screen.getByRole('textbox', { name: /^name/i })).toHaveValue('GPU inference')
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A cost sheet with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toBeInTheDocument()
  },
}

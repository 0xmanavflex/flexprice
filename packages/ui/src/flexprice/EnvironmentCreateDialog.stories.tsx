import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EnvironmentCreateDialog } from './EnvironmentCreateDialog'

/**
 * Creating an environment, as a dialog. The submit button lives in the dialog's
 * footer and reaches the form by `form="…"`; a validated environment comes out.
 * Open by default so the surface is visible. No provider, no network.
 */
const meta = {
  title: 'Surfaces/EnvironmentCreateDialog',
  component: EnvironmentCreateDialog,
  parameters: { layout: 'fullscreen' },
  args: { open: true, onOpenChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof EnvironmentCreateDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // The dialog renders in a portal, so query the whole document body.
    const screen = within(canvasElement.ownerDocument.body)
    await expect(
      await screen.findByRole('heading', { name: 'New environment' }),
    ).toBeInTheDocument()
    // The safe environment is what you get by not choosing.
    await expect(screen.getByRole('radio', { name: /sandbox/i })).toBeChecked()
  },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const SubmitError: Story = {
  args: { submitError: 'An environment with that name already exists.' },
  play: async ({ canvasElement }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
  },
}

/** The footer's Create submits the form, which the domain schema guards. */
export const RequiresAName: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.click(await screen.findByRole('button', { name: 'Create' }))
    await expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAValidEnvironment: Story = {
  play: async ({ canvasElement, args }) => {
    const screen = within(canvasElement.ownerDocument.body)
    await userEvent.type(await screen.findByRole('textbox', { name: /name/i }), 'EU staging')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: 'EU staging', type: 'development' })
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { EnvironmentRenameForm } from './EnvironmentRenameForm'

/** The dialog portals to the document, so the play functions read from there. */
const meta = {
  title: 'Flexprice/EnvironmentRenameForm',
  component: EnvironmentRenameForm,
  args: {
    open: true,
    name: 'Staging',
    onOpenChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof EnvironmentRenameForm>

export default meta
type Story = StoryObj<typeof meta>

const dialog = () => within(document.body)

/** The field starts from the current name. */
export const Default: Story = {
  play: async () => {
    await expect(dialog().getByRole('textbox', { name: 'Name' })).toHaveValue('Staging')
  },
}

export const SubmitsTheNewName: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    const field = canvas.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(field)
    await userEvent.type(field, 'EU staging')
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('EU staging')
  },
}

export const RequiresAName: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Name' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }))
    const message = await canvas.findByText('Enter a name')
    await waitFor(() => expect(message).toBeVisible())
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Failed: Story = {
  args: { submitError: 'An environment with that name already exists.' },
  play: async () => {
    await expect(dialog().getByRole('alert')).toHaveTextContent(/already exists/i)
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ChangePasswordDialog } from './ChangePasswordDialog'

/** Change your own password, from the account menu (self-hosted). */
const meta = {
  title: 'Pages/Auth/ChangePasswordDialog',
  component: ChangePasswordDialog,
  args: { open: true, onOpenChange: fn(), onSubmit: fn() },
} satisfies Meta<typeof ChangePasswordDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The domain's rules run before anything is sent. */
export const ValidatesBeforeSending: Story = {
  play: async ({ args }) => {
    const body = within(document.body)
    await userEvent.type(await body.findByLabelText(/New password/), 'short')
    await userEvent.click(body.getByRole('button', { name: 'Change password' }))
    await expect(await body.findByText('Use at least 12 characters')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Saving: Story = { args: { isPending: true } }

export const Refused: Story = { args: { error: 'That password was refused. Try another.' } }

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { PasswordLinkDialog } from './PasswordLinkDialog'

/** A one-time link for a member to set their own password (self-hosted). */
const meta = {
  title: 'Pages/Auth/PasswordLinkDialog',
  component: PasswordLinkDialog,
  args: {
    member: { name: 'Ada Lovelace', email: 'ada@example.com' },
    link: {
      url: 'https://console.example.com/set-password#token=mock.reset.1.user_1',
      purpose: 'reset',
      expiry: 'Nov 11, 2026, 9:00 AM',
    },
    onClose: fn(),
  },
} satisfies Meta<typeof PasswordLinkDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Reset: Story = {
  play: async () => {
    const body = within(document.body)
    await expect(await body.findByText('Password link for Ada Lovelace')).toBeInTheDocument()
  },
}

export const Invitation: Story = {
  args: {
    link: {
      url: 'https://console.example.com/set-password#token=mock.invite.1.user_1',
      purpose: 'invite',
      expiry: 'Nov 17, 2026, 9:00 AM',
    },
  },
}

export const Creating: Story = { args: { link: null, isPending: true } }

export const Failed: Story = { args: { link: null, error: 'The link could not be created.' } }

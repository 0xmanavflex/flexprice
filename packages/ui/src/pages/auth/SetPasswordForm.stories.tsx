import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SetPasswordForm } from './SetPasswordForm'

/** Choose a new password at the end of a reset link. */
const meta = {
  title: 'Pages/Auth/SetPasswordForm',
  component: SetPasswordForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: fn(), onSignIn: fn(), onRequestAnother: fn() },
} satisfies Meta<typeof SetPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Choose a new password',
    )
  },
}

/** The rules are the domain's: twelve characters, and the same one twice. */
export const ValidatesBeforeSending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('New password'), 'short')
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'different')
    await userEvent.click(canvas.getByRole('button', { name: 'Save password' }))

    await expect(await canvas.findByText('Use at least 12 characters')).toBeInTheDocument()
    await expect(canvas.getByText('These do not match')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** The confirmation exists to catch a typo, so one toggle reveals both fields. */
export const RevealsBothFields: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const password = canvas.getByLabelText('New password')
    const confirm = canvas.getByLabelText('Confirm password')

    await expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(canvas.getByLabelText('Show password'))
    await expect(password).toHaveAttribute('type', 'text')
    await expect(confirm).toHaveAttribute('type', 'text')
  },
}

/** A valid password goes out; the confirmation stays in the form. */
export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('New password'), 'correct-horse-battery')
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'correct-horse-battery')
    await userEvent.click(canvas.getByRole('button', { name: 'Save password' }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      password: 'correct-horse-battery',
      confirm: 'correct-horse-battery',
    })
  },
}

/**
 * No link, or a spent one. A recovery link is single-use, so the form is
 * replaced rather than shown with an error it cannot clear.
 */
export const Expired: Story = {
  args: { expired: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'That link has expired',
    )
    await expect(canvas.queryByLabelText('New password')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Request a new link' })).toBeVisible()
  },
}

/** Changed. The link is spent, so the way on is sign-in, not the form again. */
export const Done: Story = {
  args: { done: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Password changed')
    await expect(canvas.queryByLabelText('New password')).toBeNull()
  },
}

/** What Supabase said, passed through: it carries the project's own policy. */
export const Rejected: Story = {
  args: { error: 'Password should contain at least one symbol.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('at least one symbol')
  },
}

/** A self-hosted invitation link: the member's email, and their first password. */
export const InvitationLink: Story = {
  args: {
    title: 'Set your password',
    description: 'Choose the password you will sign in to Flexprice with.',
    email: 'amara@northwind.example',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Set your password')
    await expect(canvas.getByLabelText('Email')).toHaveValue('amara@northwind.example')
  },
}

/** While the link is being checked there is nothing to fill in. */
export const CheckingLink: Story = {
  args: { checking: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Checking your link…')).toBeInTheDocument()
    await expect(canvas.queryByLabelText('New password')).not.toBeInTheDocument()
  },
}

/** A spent admin link: the way on is the admin, not a request form. */
export const ExpiredAdminLink: Story = {
  render: ({ onRequestAnother: _omitted, ...args }) => <SetPasswordForm {...args} />,
  args: {
    expired: true,
    expiredDescription: 'Links are good for one use. Ask your admin for a new one.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Ask your admin for a new one/)).toBeInTheDocument()
    await expect(
      canvas.queryByRole('button', { name: 'Request a new link' }),
    ).not.toBeInTheDocument()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ForgotPasswordForm } from './ForgotPasswordForm'

/**
 * Request a password reset. Validation is the domain schema's, and the
 * confirmation replaces the form on the same screen without revealing whether
 * the address has an account. No provider, no network.
 */
const meta = {
  title: 'App/Sign-in/Forgot password form',
  component: ForgotPasswordForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: fn(), onBack: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    sentTo: { control: 'text', description: 'Set an address to show the confirmation screen.' },
    error: { control: 'text', description: 'Empty means no error.' },
    onSubmit: { control: false },
    onBack: { control: false },
  },
} satisfies Meta<typeof ForgotPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  isSubmitting: boolean
  sentTo: string
  error: string
  showBack: boolean
  onSubmit: () => void
  onBack: () => void
}

/** Flip submitting, a failure, or the sent confirmation; hide the back link. */
export const Playground = {
  args: {
    isSubmitting: false,
    sentTo: '',
    error: '',
    showBack: true,
    onSubmit: fn(),
    onBack: fn(),
  },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    sentTo: { control: 'text', description: 'Set an address to show the confirmation screen.' },
    error: { control: 'text', description: 'Empty means no error.' },
    showBack: { control: 'boolean', description: 'Offer the back-to-sign-in action.' },
    onSubmit: { control: false },
    onBack: { control: false },
  },
  parameters: {
    controls: { include: ['isSubmitting', 'sentTo', 'error', 'showBack', 'onSubmit', 'onBack'] },
  },
  render: ({ isSubmitting, sentTo, error, showBack, onSubmit, onBack }) => (
    <ForgotPasswordForm
      isSubmitting={isSubmitting}
      sentTo={sentTo || null}
      error={error || null}
      onSubmit={onSubmit}
      {...(showBack ? { onBack } : {})}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {}

export const Submitting: Story = { args: { isSubmitting: true } }

export const Failed: Story = {
  args: { error: 'We could not send the email. Try again.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/**
 * The confirmation is the same either way.
 *
 * A message that changes when the address has no account turns the form into a
 * way of discovering who has one, so it never says.
 */
export const Sent: Story = {
  args: { sentTo: 'finance@acme.com' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    await expect(canvas.getByText('finance@acme.com')).toBeInTheDocument()
    await expect(canvas.getByText(/has an account/i)).toBeInTheDocument()
    // The form is gone: no email field remains to retype.
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument()
  },
}

export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset link' }))
    await expect(await canvas.findByText('Enter your email')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const RejectsAMalformedEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Email'), 'a@b.c')
    await userEvent.tab()
    await expect(
      await canvas.findByText('That does not look like an email address'),
    ).toBeInTheDocument()
  },
}

export const SubmitsAnEmail: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Email'), 'finance@acme.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset link' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ email: 'finance@acme.com' })
  },
}

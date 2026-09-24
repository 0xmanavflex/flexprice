import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ForgotPasswordForm } from './ForgotPasswordForm'

const meta = {
  title: 'Surfaces/ForgotPasswordForm',
  component: ForgotPasswordForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: fn(), onBack: fn() },
} satisfies Meta<typeof ForgotPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Submitting: Story = { args: { isSubmitting: true } }
export const Failed: Story = { args: { error: 'We could not send that right now.' } }

export const ValidatesTheEmail: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset link' }))
    await expect(await canvas.findByText('Enter your email')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Email'), 'finance@acme.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Send reset link' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ email: 'finance@acme.com' })
  },
}

/**
 * The confirmation replaces the form on the same screen.
 *
 * Navigating away for one sentence loses the email they typed and makes "did
 * that work?" answerable only by going back. It also never says whether the
 * address exists — a different message either way would turn this form into a
 * way of discovering who has an account.
 */
export const ConfirmationDoesNotRevealWhetherAnAccountExists: Story = {
  args: { sentTo: 'finance@acme.com' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toBeInTheDocument()
    await expect(canvas.getByText(/if/i)).toBeInTheDocument()
    await expect(canvas.getByText(/has an account/i)).toBeInTheDocument()
    // The form is gone, not merely hidden below it.
    await expect(canvas.queryByLabelText('Email')).not.toBeInTheDocument()
  },
}

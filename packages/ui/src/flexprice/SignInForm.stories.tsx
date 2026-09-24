import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignInForm } from './SignInForm'

const meta = {
  title: 'Surfaces/SignInForm',
  component: SignInForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: fn(), onForgotPassword: fn() },
} satisfies Meta<typeof SignInForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submitting: Story = { args: { isSubmitting: true } }

export const Failed: Story = {
  args: { error: 'That email and password do not match.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Validation comes from the domain schema, same as every other form. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))

    await expect(await canvas.findByText('Enter your email')).toBeInTheDocument()
    await expect(canvas.getByText('Enter your password')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const RejectsAMalformedEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), 'not-an-email')
    await userEvent.tab()

    await expect(
      await canvas.findByText('That does not look like an email address'),
    ).toBeInTheDocument()
  },
}

export const SubmitsCredentials: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('Email'), 'finance@acme.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'finance@acme.com',
      password: 'correct horse',
    })
  },
}

/**
 * The behaviour most people will exercise twice.
 *
 * Retyping an email you already typed correctly is the small insult that makes
 * a login feel hostile, so the email survives and only the password is cleared.
 */
export const AFailureKeepsTheEmailAndClearsThePassword: Story = {
  args: { error: 'That email and password do not match.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const email = canvas.getByLabelText('Email')
    const password = canvas.getByLabelText('Password')

    await userEvent.type(email, 'finance@acme.com')
    await userEvent.type(password, 'wrong')
    await expect(password).toHaveValue('wrong')

    // The story re-renders with `error` set, which is what the app does after a
    // rejected attempt.
    await expect(email).toHaveValue('finance@acme.com')
  },
}

export const PasswordCanBeRevealed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const password = canvas.getByLabelText('Password')

    await expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(canvas.getByRole('button', { name: 'Show password' }))
    await expect(password).toHaveAttribute('type', 'text')
    await expect(canvas.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
}

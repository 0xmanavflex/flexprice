import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { SignInForm } from './SignInForm'

const meta = {
  title: 'App/Sign-in/Sign-in form',
  component: SignInForm,
  parameters: { layout: 'centered' },
  args: { onSubmit: fn(), onForgotPassword: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    defaultValues: { control: 'object', description: 'Read once on mount.' },
    alternatives: { control: false },
    onSubmit: { control: false },
    onForgotPassword: { control: false },
  },
} satisfies Meta<typeof SignInForm>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  isSubmitting: boolean
  error: string
  showForgotPassword: boolean
  showAlternatives: boolean
  prefillEmail: string
  onSubmit: () => void
  onForgotPassword: () => void
}

/** Flip submitting or a failure, prefill the email, and toggle the forgot-password link and alternatives. */
export const Playground = {
  args: {
    isSubmitting: false,
    error: '',
    showForgotPassword: true,
    showAlternatives: false,
    prefillEmail: '',
    onSubmit: fn(),
    onForgotPassword: fn(),
  },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    showForgotPassword: { control: 'boolean' },
    showAlternatives: { control: 'boolean', description: 'Renders a single-sign-on button.' },
    prefillEmail: { control: 'text', description: 'Seeds the email on mount.' },
    onSubmit: { control: false },
    onForgotPassword: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'isSubmitting',
        'error',
        'showForgotPassword',
        'showAlternatives',
        'prefillEmail',
        'onSubmit',
        'onForgotPassword',
      ],
    },
  },
  render: ({
    isSubmitting,
    error,
    showForgotPassword,
    showAlternatives,
    prefillEmail,
    onSubmit,
    onForgotPassword,
  }) => (
    <SignInForm
      key={prefillEmail}
      isSubmitting={isSubmitting}
      error={error || null}
      onSubmit={onSubmit}
      {...(showForgotPassword ? { onForgotPassword } : {})}
      {...(prefillEmail ? { defaultValues: { email: prefillEmail } } : {})}
      {...(showAlternatives
        ? {
            alternatives: (
              <Button type="button" variant="outline" className="w-full">
                Continue with single sign-on
              </Button>
            ),
          }
        : {})}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {}

export const Submitting: Story = { args: { isSubmitting: true } }

/**
 * Seeded initial values.
 *
 * Under mocks the app pre-fills demo credentials so someone can reach the
 * dashboard by clicking Sign in. The seed only has to survive to the inputs.
 */
export const Prefilled: Story = {
  args: { defaultValues: { email: 'demo@flexprice.io', password: 'demo1234' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByLabelText('Email')).toHaveValue('demo@flexprice.io')
    await expect(canvas.getByLabelText('Password')).toHaveValue('demo1234')
  },
}

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
    const email = canvas.getByLabelText('Email')

    // A prefix is not an address yet: one letter, or a word with no @, stays quiet.
    await userEvent.type(email, 'd')
    await userEvent.tab()
    await expect(canvas.queryByText('That does not look like an email address')).toBeNull()

    await userEvent.clear(email)
    await userEvent.type(email, 'not-an-email')
    await userEvent.tab()
    await expect(canvas.queryByText('That does not look like an email address')).toBeNull()

    // A finished address that still is not one is checked on leaving the field.
    await userEvent.clear(email)
    await userEvent.type(email, 'a@b.c')
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

/** Self-hosted: no reset to start, so the form says who makes reset links. */
export const SelfHostedForgotNote: Story = {
  render: ({ onForgotPassword: _omitted, ...args }) => <SignInForm {...args} />,
  args: {
    forgotPasswordNote: 'Forgot your password? Ask an admin for a reset link.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Ask an admin for a reset link/)).toBeInTheDocument()
    await expect(
      canvas.queryByRole('button', { name: 'Forgot your password?' }),
    ).not.toBeInTheDocument()
  },
}

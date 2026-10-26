import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignInScreen } from './SignInScreen'

/**
 * The full sign-in page: `SignInForm` on the ReUI `auth-6` split layout.
 *
 * `fullscreen`, not `centered`: the whole point of this component is the
 * two-column split and the panel beside it, and a centred canvas would show
 * neither.
 */
const meta = {
  title: 'App/Sign-in/Sign-in screen',
  component: SignInScreen,
  parameters: { layout: 'fullscreen' },
  args: { onSubmit: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    hint: { control: 'text' },
    defaultValues: { control: 'object', description: 'Read once on mount.' },
    alternatives: { control: false },
    onSubmit: { control: false },
    onForgotPassword: { control: false },
    onProvider: { control: false },
    onSignUp: { control: false },
    onTerms: { control: false },
    onPrivacy: { control: false },
  },
} satisfies Meta<typeof SignInScreen>

export default meta
type Story = StoryObj<typeof meta>

interface PlaygroundArgs {
  isSubmitting: boolean
  error: string
  hint: string
  showForgotPassword: boolean
  showProviders: boolean
  showSignUp: boolean
  showLegal: boolean
  onSubmit: () => void
  onForgotPassword: () => void
  onProvider: (providerId: string) => void
  onSignUp: () => void
  onTerms: () => void
  onPrivacy: () => void
}

/** Flip submitting, a failure or a notice, and light up each optional part of the page. */
/**
 * Single sign-on, offered when the link names a tenant.
 *
 * It names the method rather than a brand: SSO is per tenant and the screen
 * is not told which identity provider is behind it.
 */
export const WithSso: Story = {
  args: { onSso: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Continue with SSO' })
    await userEvent.click(button)
    await expect(args.onSso).toHaveBeenCalled()
  },
}

/** While the login is being started the button says so and refuses a second press. */
export const SsoStarting: Story = {
  args: { onSso: fn(), ssoPending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  },
}

export const Playground = {
  args: {
    isSubmitting: false,
    error: '',
    hint: '',
    showForgotPassword: true,
    showProviders: false,
    showSignUp: false,
    showLegal: false,
    onSubmit: fn(),
    onForgotPassword: fn(),
    onProvider: fn(),
    onSignUp: fn(),
    onTerms: fn(),
    onPrivacy: fn(),
  },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    hint: { control: 'text', description: 'Notice above the form; empty hides it.' },
    showForgotPassword: { control: 'boolean' },
    showProviders: { control: 'boolean', description: 'Wire the social provider buttons.' },
    showSignUp: { control: 'boolean' },
    showLegal: { control: 'boolean', description: 'Wire the terms and privacy links.' },
    onSubmit: { control: false },
    onForgotPassword: { control: false },
    onProvider: { control: false },
    onSignUp: { control: false },
    onTerms: { control: false },
    onPrivacy: { control: false },
  },
  parameters: {
    controls: {
      include: [
        'isSubmitting',
        'error',
        'hint',
        'showForgotPassword',
        'showProviders',
        'showSignUp',
        'showLegal',
        'onSubmit',
        'onForgotPassword',
        'onProvider',
        'onSignUp',
        'onTerms',
        'onPrivacy',
      ],
    },
  },
  render: ({
    isSubmitting,
    error,
    hint,
    showForgotPassword,
    showProviders,
    showSignUp,
    showLegal,
    onSubmit,
    onForgotPassword,
    onProvider,
    onSignUp,
    onTerms,
    onPrivacy,
  }) => (
    <SignInScreen
      isSubmitting={isSubmitting}
      error={error || null}
      onSubmit={onSubmit}
      {...(hint ? { hint } : {})}
      {...(showForgotPassword ? { onForgotPassword } : {})}
      {...(showProviders ? { onProvider } : {})}
      {...(showSignUp ? { onSignUp } : {})}
      {...(showLegal ? { onTerms, onPrivacy } : {})}
    />
  ),
} satisfies StoryObj<PlaygroundArgs>

export const Default: Story = {}

/** With everything a deployment can light up: providers, sign-up, legal. */
export const FullyConfigured: Story = {
  args: {
    onProvider: fn(),
    onSignUp: fn(),
    onTerms: fn(),
    onPrivacy: fn(),
    onForgotPassword: fn(),
  },
}

/**
 * A deployment that does not offer Google does not draw the button.
 *
 * It used to render always and explain on click that it was not enabled, which
 * reads as a broken feature rather than an absent one. The app now passes
 * `onProvider` only when `useAuthCapabilities` reports Google as available, so
 * the absence of the prop is the absence of the button.
 */
export const ProviderNotConfigured: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
    // Password sign-in is still fully there: that is the point of failing open.
    await expect(canvas.getByRole('button', { name: /sign in/i })).toBeVisible()
  },
}

/**
 * Mock mode: the form is pre-filled with demo credentials and a note above it
 * says so, so someone can reach the dashboard by clicking Sign in. The note is a
 * `note`, not a heading, so it does not disturb the form's h1.
 */
export const DemoMode: Story = {
  args: {
    defaultValues: { email: 'demo@flexprice.io', password: 'demo1234' },
    hint: 'Demo mode: the sample data is loaded. Just click Sign in.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('note')).toHaveTextContent(/Demo mode/)
    await expect(canvas.getByLabelText('Email')).toHaveValue('demo@flexprice.io')
    await expect(canvas.getByLabelText('Password')).toHaveValue('demo1234')
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Sign in to Flexprice',
    )
  },
}

export const Submitting: Story = { args: { isSubmitting: true } }

export const Failed: Story = {
  args: { error: 'That email and password do not match.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** The form is the page's one h1, beside the block's sidebar. */
export const HeadingAndPanel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Sign in to Flexprice',
    )
    await expect(canvasElement.querySelector('aside')).not.toBeNull()
  },
}

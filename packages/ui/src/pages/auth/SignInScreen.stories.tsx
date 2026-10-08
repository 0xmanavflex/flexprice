import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignInScreen } from './SignInScreen'

/**
 * The full sign-in page — `SignInForm` on the ReUI `auth-6` split layout.
 *
 * `fullscreen`, not `centered`: the whole point of this component is the
 * two-column split and the panel beside it, and a centred canvas would show
 * neither.
 */
const meta = {
  title: 'Surfaces/SignInScreen',
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
 * The provider row is part of the block's design, so it renders — but nothing
 * is wired to it yet. Clicking must say so rather than appear to work.
 */
export const ProviderNotConfigured: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Google' }))

    await expect(await canvas.findByRole('status')).toHaveTextContent(
      /Google sign-in isn't enabled/,
    )
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
    hint: 'Demo mode — the sample data is loaded. Just click Sign in.',
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

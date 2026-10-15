import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignUpConfirmScreen } from './SignUpConfirmScreen'

/** Where the sign-up confirmation email lands: finishing the account, or why it could not. */
const meta = {
  title: 'App/Sign-in/Sign-up confirmation',
  component: SignUpConfirmScreen,
  parameters: { layout: 'fullscreen' },
  args: { onSignIn: fn(), onSignUp: fn() },
} satisfies Meta<typeof SignUpConfirmScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Finishing: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Setting up your account',
    )
  },
}

/** A stale link says so and offers both ways on. */
export const LinkExpired: Story = {
  args: {
    error:
      'This confirmation link has expired or was already used. Sign in if you already confirmed it, or sign up again for a new link.',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Sign up again' }))
    await expect(args.onSignUp).toHaveBeenCalled()
  },
}

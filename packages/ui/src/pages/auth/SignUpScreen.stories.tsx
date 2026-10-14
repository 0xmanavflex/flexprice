import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SignUpScreen } from './SignUpScreen'

/** Create an account: the sign-in frame with work email and a password typed twice. */
const meta = {
  title: 'App/Sign-in/Sign-up screen',
  component: SignUpScreen,
  parameters: { layout: 'fullscreen' },
  args: { onSubmit: fn(), onSignIn: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    error: { control: 'text', description: 'Empty means no error.' },
    onSubmit: { control: false },
    onSignIn: { control: false },
    onProvider: { control: false },
    region: { control: false },
  },
} satisfies Meta<typeof SignUpScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account')
    await expect(canvasElement.querySelector('aside')).not.toBeNull()
  },
}

/** The API's rules: a real email, eight characters, and the same password twice. */
export const ValidatesBeforeSending: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Work email'), 'not-an-email')
    await userEvent.type(canvas.getByLabelText('Password'), '123')
    await userEvent.type(canvas.getByLabelText('Confirm password'), '456')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(await canvas.findByText('Enter a valid email address')).toBeInTheDocument()
    await expect(canvas.getByText('Use at least 8 characters')).toBeInTheDocument()
    await expect(canvas.getByText("The passwords don't match")).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Valid details go out as email and password; the confirmation stays in the form. */
export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Work email'), 'ola@acme.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'secret12')
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'secret12')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'ola@acme.com',
      password: 'secret12',
    })
  },
}

export const Failed: Story = {
  args: { error: 'An account with that email already exists. Sign in instead.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

export const BackToSignIn: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Log in' }))
    await expect(args.onSignIn).toHaveBeenCalledOnce()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
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
} satisfies Meta<typeof SignInScreen>

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

/**
 * The decorative panel must stay out of the accessibility tree.
 *
 * It repeats nothing the form says, so announcing it would put scenery between
 * the heading and the first field. `aria-hidden` is the contract; this asserts
 * it rather than trusting a class name.
 */
export const PanelIsDecorative: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Sign in to Flexprice',
    )
    await expect(canvasElement.querySelector('aside')).toHaveAttribute('aria-hidden', 'true')
    // The panel's copy is present in the DOM but not reachable by role.
    await expect(canvas.queryByText(/Billing that keeps up/)).not.toBeNull()
  },
}

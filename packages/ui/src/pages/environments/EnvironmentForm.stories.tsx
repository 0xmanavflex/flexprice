import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { EnvironmentForm } from './EnvironmentForm'

/** The dialog portals to the document, so the play functions read from there. */
const meta = {
  title: 'Flexprice/EnvironmentForm',
  component: EnvironmentForm,
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof EnvironmentForm>

export default meta
type Story = StoryObj<typeof meta>

const dialog = () => within(document.body)

export const Default: Story = {}

/**
 * Sandbox is the default, because the safe one should be what you get by not
 * choosing.
 */
export const SandboxIsPreselected: Story = {
  play: async () => {
    await expect(dialog().getByRole('radio', { name: /sandbox/i })).toBeChecked()
  },
}

export const RequiresAName: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    const message = await canvas.findByText('Enter a name')
    await waitFor(() => expect(message).toBeVisible())
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAValidEnvironment: Story = {
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), 'EU staging')
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'EU staging',
      type: 'development',
    })
  },
}

/**
 * Sandbox and Production sit side by side as two small cards, each with its
 * explainer.
 */
export const SideBySideCards: Story = {
  play: async () => {
    const canvas = dialog()
    await expect(canvas.getByRole('radio', { name: /sandbox/i })).toBeInTheDocument()
    await expect(canvas.getByRole('radio', { name: /production/i })).toBeInTheDocument()
    await expect(canvas.getByText(/nothing is charged/i)).toBeInTheDocument()
    await expect(canvas.getByText(/real customers/i)).toBeInTheDocument()
  },
}

/**
 * Production withheld: still selectable, but create is disabled.
 *
 * Choosing Production is how someone asks for it, so the card is not greyed
 * out. What changes is the way forward — "Create environment" is disabled and
 * a short contact note with a Slack link takes its place.
 */
export const ProductionUnavailable: Story = {
  args: {
    canCreateProduction: false,
    contactHref: 'https://example.com/slack',
  },
  play: async () => {
    const canvas = dialog()
    const production = canvas.getByRole('radio', { name: /production/i })
    await expect(production).not.toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeEnabled()

    await userEvent.click(production)
    await waitFor(() => expect(production).toBeChecked())
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeDisabled()
    // Waited for, not asserted once: the dialog fades in, and `toBeVisible`
    // correctly says no while its panel is still at opacity 0.
    await waitFor(() => expect(canvas.getByText(/set up with our team/i)).toBeVisible())
    await expect(canvas.getByRole('link', { name: /slack/i })).toHaveAttribute(
      'href',
      'https://example.com/slack',
    )

    // Back to Sandbox, and create is available again.
    await userEvent.click(canvas.getByRole('radio', { name: /sandbox/i }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Create environment' })).toBeEnabled(),
    )
  },
}

/** Submitting disables the fields. */
export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async () => {
    await expect(dialog().getByRole('textbox', { name: /name/i })).toBeDisabled()
  },
}

export const Failed: Story = {
  args: { submitError: 'An environment with that name already exists.' },
  play: async () => {
    await expect(dialog().getByRole('alert')).toHaveTextContent(/already exists/i)
  },
}

/**
 * The form refuses what the button only discourages.
 *
 * A submit can also arrive by Enter in the name field, so the refusal is in the
 * submit handler too, not only on the disabled button.
 */
export const ProductionCannotBeSubmittedWhenWithheld: Story = {
  args: {
    canCreateProduction: false,
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), '{Enter}')
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(canvas.getByRole('button', { name: 'Create environment' })).toBeDisabled()
  },
}

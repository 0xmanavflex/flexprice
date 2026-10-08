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
 * Production withheld is shown, not hidden.
 *
 * An option that silently does not exist reads as a bug, and people go looking
 * for it. Disabled with the reason attached answers the question instead.
 */
export const ProductionUnavailable: Story = {
  args: {
    canCreateProduction: false,
    productionUnavailableReason: 'Set up with your account contact.',
  },
  play: async () => {
    const canvas = dialog()
    await expect(canvas.getByRole('radio', { name: /production/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    // Waited for, not asserted once. The dialog fades in, so at the moment the
    // radio above resolves its panel can still be at opacity 0 — the text is
    // in the DOM and laid out, and `toBeVisible` is correctly saying no. A
    // single assertion here is a race the suite loses on a slower machine.
    await waitFor(() => expect(canvas.getByText(/account contact/i)).toBeVisible())
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
 * The form refuses what the control only discourages.
 *
 * `aria-disabled` is an announcement, not a lock — the element still takes a
 * click in some paths, and a value that reached the schema would otherwise be
 * submitted. So the refusal is in the submit handler too.
 */
export const ProductionCannotBeSubmittedWhenWithheld: Story = {
  args: {
    canCreateProduction: false,
    productionUnavailableReason: 'Set up with your account contact.',
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/account contact/i)
  },
}

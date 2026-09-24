import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EnvironmentForm } from './EnvironmentForm'

const meta = {
  title: 'Flexprice/EnvironmentForm',
  component: EnvironmentForm,
  args: { onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof EnvironmentForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/**
 * Sandbox is the default, because the safe one should be what you get by not
 * choosing.
 */
export const SandboxIsPreselected: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: /sandbox/i })).toBeChecked()
  },
}

export const RequiresAName: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    await expect(await canvas.findByText('Enter a name')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAValidEnvironment: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), 'EU staging')
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    // One argument: the form emits a validated value, not a form event.
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
    productionUnavailableReason:
      'Production environments are set up with us. Talk to your account contact to add one.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Base UI renders a radio as `span[role=radio]`, so it carries
    // `aria-disabled` rather than the form-element `disabled` attribute —
    // which is also why the form refuses the value rather than trusting it.
    await expect(canvas.getByRole('radio', { name: /production/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(canvas.getByText(/talk to your account contact/i)).toBeVisible()
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /creating/i }),
    ).toBeDisabled()
  },
}

export const Failed: Story = {
  args: { submitError: 'An environment with that name already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(/already exists/i)
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
    productionUnavailableReason: 'Production environments are set up with us.',
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create environment' }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/set up with us/i)
  },
}

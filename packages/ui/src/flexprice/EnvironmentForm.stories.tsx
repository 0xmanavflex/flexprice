import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EnvironmentForm } from './EnvironmentForm'

/**
 * The form renders no buttons — the dialog that hosts it owns those and
 * reaches back with `form="…"`. The decorator stands in for that footer, so
 * these stories exercise the same wiring the dialog uses rather than a
 * submission the component could never receive in production.
 */
const meta = {
  title: 'Flexprice/EnvironmentForm',
  component: EnvironmentForm,
  decorators: [
    (Story) => (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Story />
        <button type="submit" form="environment-form" className="self-end border px-3 py-1.5">
          Create
        </button>
      </div>
    ),
  ],
  args: { id: 'environment-form', onSubmit: fn() },
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
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }))
    await expect(await canvas.findByText('Enter a name')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const SubmitsAValidEnvironment: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /name/i }), 'EU staging')
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }))
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
    productionUnavailableReason: 'Set up with your account contact.',
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
    await expect(canvas.getByText(/account contact/i)).toBeVisible()
  },
}

/** Submitting disables the fields; the buttons belong to the dialog. */
export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox', { name: /name/i })).toBeDisabled()
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
    productionUnavailableReason: 'Set up with your account contact.',
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/account contact/i)
  },
}

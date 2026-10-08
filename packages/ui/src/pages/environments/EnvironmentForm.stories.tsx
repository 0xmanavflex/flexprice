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
 * Production withheld is still a choice: picking it disables Create and the
 * button says "Contact us", so the person learns what to do instead of hitting
 * a dead radio.
 */
export const ProductionUnavailable: Story = {
  args: { canCreateProduction: false },
  play: async ({ args }) => {
    const canvas = dialog()
    await userEvent.click(canvas.getByRole('radio', { name: /production/i }))
    const contact = await canvas.findByRole('button', { name: 'Contact us' })
    await waitFor(() => expect(contact).toBeDisabled())
    await expect(args.onSubmit).not.toHaveBeenCalled()
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

/** The form refuses what the disabled button only discourages. */
export const ProductionCannotBeSubmittedWhenWithheld: Story = {
  args: {
    canCreateProduction: false,
    defaultValue: { name: 'Sneaky', type: 'production' },
  },
  play: async ({ args }) => {
    const canvas = dialog()
    const contact = await canvas.findByRole('button', { name: 'Contact us' })
    await waitFor(() => expect(contact).toBeDisabled())
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

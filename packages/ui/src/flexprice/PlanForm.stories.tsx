import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PlanForm } from './PlanForm'

/**
 * The plan details form — the drawer's contents. Same proof as every form here:
 * fixtures in, a validated `CreatePlan` out, no provider, no network.
 */
const meta = {
  title: 'Surfaces/PlanForm',
  component: PlanForm,
  parameters: { layout: 'padded' },
  args: { mode: 'create', onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof PlanForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'Pro', lookupKey: 'pro', description: 'For growing teams' },
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true, defaultValue: { name: 'Pro', lookupKey: 'pro' } },
}

export const SubmitError: Story = {
  args: {
    submitError: 'A plan with that lookup key already exists.',
    defaultValue: { name: 'Pro', lookupKey: 'pro' },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** Only the name is required — a plan's lookup key is optional. */
export const NameIsTheOnlyRequirement: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /create plan/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()

    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Pro')
    await userEvent.click(canvas.getByRole('button', { name: /create plan/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pro' }),
    )
  },
}

/** A malformed lookup key is rejected even though the field is optional. */
export const RejectsAMalformedLookupKey: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Pro')
    await userEvent.type(canvas.getByLabelText('Lookup key'), 'Pro Plan')
    await userEvent.click(canvas.getByRole('button', { name: /create plan/i }))

    await expect(
      await canvas.findByText('Use lowercase letters, numbers and underscores'),
    ).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

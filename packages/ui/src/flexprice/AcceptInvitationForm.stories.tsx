import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AcceptInvitationForm } from './AcceptInvitationForm'

const meta = {
  title: 'Surfaces/AcceptInvitationForm',
  component: AcceptInvitationForm,
  parameters: { layout: 'centered' },
  args: {
    organisation: 'Acme Corp',
    role: 'Finance (read only)',
    email: 'newhire@acme.com',
    onSubmit: fn(),
  },
} satisfies Meta<typeof AcceptInvitationForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Submitting: Story = { args: { isSubmitting: true } }
export const Expired: Story = { args: { error: 'This invitation has expired. Ask for a new one.' } }

/**
 * What you are joining, before what you must type.
 *
 * Somebody arriving from an email has no other way to know, and "read only"
 * versus "admin" is exactly the difference worth noticing before accepting.
 */
export const StatesTheOrganisationAndRole: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Join Acme Corp' })).toBeInTheDocument()
    await expect(canvas.getByText('Finance (read only)')).toBeInTheDocument()
    await expect(canvas.getByText('newhire@acme.com')).toBeInTheDocument()
  },
}

/** Length, not character classes. Rules like "one symbol" produce `Password1!`. */
export const RequiresLengthNotComplexity: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Choose a password'), 'short')
    await userEvent.tab()
    await expect(await canvas.findByText('Use at least 12 characters')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A typo in a password field is invisible by definition. */
export const CatchesAMismatch: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Choose a password'), 'correct horse battery')
    await userEvent.type(canvas.getByLabelText('Type it again'), 'correct horse batteru')
    await userEvent.click(canvas.getByRole('button', { name: 'Join Acme Corp' }))

    await expect(await canvas.findByText('These do not match')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Choose a password'), 'correct horse battery')
    await userEvent.type(canvas.getByLabelText('Type it again'), 'correct horse battery')
    await userEvent.click(canvas.getByRole('button', { name: 'Join Acme Corp' }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      password: 'correct horse battery',
      confirm: 'correct horse battery',
    })
  },
}

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CreditGrantCreateForm, CreditGrantEditForm } from './CreditGrantForm'

/**
 * The credit-grant form, as it renders inside a plan's Credit grants section
 * (in place) or a plan create step. Create: recurring reveals a period, a
 * duration expiry reveals a length. Edit: only the name and end date change.
 */
const inSection: Decorator = (Story) => (
  <div className="bg-card max-w-2xl rounded-xl border p-5">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/CreditGrantForm',
  component: CreditGrantCreateForm,
  parameters: { layout: 'padded' },
  decorators: [inSection],
  args: { onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof CreditGrantCreateForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Credits must be a positive number. */
export const RequiresPositiveCredits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create credit grant/i }))
    await expect(await canvas.findByText('Enter an amount')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A named grant with credits submits the validated value. */
export const SubmitsAGrant: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByRole('textbox', { name: /^Name/ })
    await userEvent.clear(name)
    await userEvent.type(name, 'Welcome credits')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Credits/ }), '500')
    await userEvent.click(canvas.getByRole('button', { name: /create credit grant/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Welcome credits', credits: expect.anything() }),
    )
  },
}

export const Edit: Story = {
  render: (args) => (
    <CreditGrantEditForm
      defaultValue={{ name: 'Welcome credits' }}
      onSubmit={fn()}
      {...(args.onCancel ? { onCancel: args.onCancel } : {})}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByDisplayValue('Welcome credits'),
    ).toBeInTheDocument()
  },
}

export const SubmitError: Story = {
  args: { submitError: 'Could not create the grant. Try again.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

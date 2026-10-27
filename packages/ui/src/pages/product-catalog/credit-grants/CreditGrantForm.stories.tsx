import type { ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, within } from 'storybook/test'
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
  title: 'App/Product catalog/Credit grants/Credit grant form',
  component: CreditGrantCreateForm,
  parameters: { layout: 'padded' },
  decorators: [inSection],
  args: { onSubmit: fn(), onCancel: fn() },
  argTypes: {
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    submitLabel: { control: 'text' },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof CreditGrantCreateForm>

export default meta
type Story = StoryObj<typeof meta>

/** Switch create/edit, submitting, a server error and the submit label from the controls. */
export const Playground: StoryObj<
  ComponentProps<typeof CreditGrantCreateForm> & { mode: 'create' | 'edit' }
> = {
  args: { mode: 'create', isSubmitting: false, submitError: '', submitLabel: '' },
  argTypes: { mode: { control: 'inline-radio', options: ['create', 'edit'] } },
  render: ({ mode, submitError, submitLabel, onSubmit: _onSubmit, ...args }) =>
    mode === 'edit' ? (
      <CreditGrantEditForm
        key="edit"
        {...args}
        onSubmit={fn()}
        defaultValue={{ name: 'Welcome credits' }}
        submitError={submitError || null}
        {...(submitLabel ? { submitLabel } : {})}
      />
    ) : (
      <CreditGrantCreateForm
        key="create"
        {...args}
        onSubmit={fn()}
        submitError={submitError || null}
        {...(submitLabel ? { submitLabel } : {})}
      />
    ),
}

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

/** The end date is a UTC day: shown as that day, and sent as the end of the day picked. */
export const EndDateIsAUtcDay: Story = {
  parameters: {
    // Base UI focus guards and the vendored calendar popover: see DateInput.stories.tsx.
    a11y: {
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'aria-dialog-name', enabled: false },
        ],
      },
    },
  },
  render: function Render(args) {
    return (
      <CreditGrantEditForm
        allowEndDate
        defaultValue={{ name: 'Welcome credits', endDate: new Date('2027-03-10T23:59:59.999Z') }}
        onSubmit={args.onSubmit}
      />
    )
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const end = canvas.getByRole('button', { name: /^End date/ })
    await expect(end).toHaveTextContent('Mar 10, 2027')
    await userEvent.click(end)
    await userEvent.click(await screen.findByRole('button', { name: /March 20/ }))
    await userEvent.click(canvas.getByRole('button', { name: /save/i }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ endDate: new Date('2027-03-20T23:59:59.999Z') }),
    )
  },
}

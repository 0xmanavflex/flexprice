import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AddonForm } from './AddonForm'

/**
 * The add-on details form: the full-page Create/Edit body, proved the same way as every
 * form here: fixtures in, a validated `CreateAddon` out, no provider, no network.
 */
const trail: { label: string }[] = [{ label: 'Add-ons' }, { label: 'Create add-on' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Product catalog/Add-ons/Add-on form',
  component: AddonForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { mode: 'create', trail, onSubmit: fn(), onCancel: fn() },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Server-side failure; empty means none.' },
    defaultValue: { control: false },
    trail: { control: false },
    onSubmit: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof AddonForm>

export default meta
type Story = StoryObj<typeof meta>

const editValue = {
  name: 'Priority support',
  lookupKey: 'priority_support',
  description: 'Faster response times and a named contact',
}

/** Flip create/edit, submitting and a server error from the controls. */
/** The lookup key is filled from the name until the person types their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: /^lookup key/i })

    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Acme Pro')
    await expect(field).toHaveValue('addon-acme-pro')

    await userEvent.clear(field)
    await userEvent.type(field, 'mine')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), ' Plus')
    await expect(field).toHaveValue('mine')
  },
}

export const Playground: Story = {
  args: { isSubmitting: false, submitError: '' },
  render: ({ mode, submitError, ...args }) => (
    <AddonForm
      key={mode}
      {...args}
      mode={mode}
      submitError={submitError || null}
      {...(mode === 'edit' ? { defaultValue: editValue } : {})}
    />
  ),
}

export const Create: Story = {}

/** The close (X) hands control back to the caller. */
export const CloseReturns: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Close form' }))
    await expect(args.onCancel).toHaveBeenCalled()
  },
}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: {
      name: 'Priority support',
      lookupKey: 'priority_support',
      description: 'Faster response times and a named contact',
    },
  },
}

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    defaultValue: { name: 'Priority support', lookupKey: 'priority_support' },
  },
}

export const SubmitError: Story = {
  args: {
    submitError: 'An add-on with that lookup key already exists.',
    defaultValue: { name: 'Priority support', lookupKey: 'priority_support' },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** The lookup key cannot be edited once set: the field is read-only in edit. */
export const LookupKeyLockedOnEdit: Story = {
  args: {
    mode: 'edit',
    defaultValue: { name: 'Priority support', lookupKey: 'priority_support' },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Lookup key')
    await expect(input).toHaveAttribute('readonly')
  },
}

/** Validation is the domain schema's, reached through the form. */
export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /create add-on/i }))

    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(canvas.getByText('Enter a lookup key')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** An uppercase or spaced lookup key is rejected by the schema's rule. */
export const RejectsAMalformedLookupKey: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Queried by role/accessible name: the required fields carry a visual "*"
    // in the label text, which the accessible name (and a screen reader) omits.
    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Priority support')
    const lookupKey = canvas.getByRole('textbox', { name: 'Lookup key' })
    await userEvent.clear(lookupKey)
    await userEvent.type(lookupKey, 'Priority Support')
    await userEvent.click(canvas.getByRole('button', { name: /create add-on/i }))

    await expect(
      await canvas.findByText('Use lowercase letters, numbers, hyphens and underscores'),
    ).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** A valid draft submits a parsed domain value. */
export const SubmitsAValidatedDomainValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByRole('textbox', { name: 'Name' }), 'Priority support')
    const lookupKey = canvas.getByRole('textbox', { name: 'Lookup key' })
    await userEvent.clear(lookupKey)
    await userEvent.type(lookupKey, 'priority_support')

    await userEvent.click(canvas.getByRole('button', { name: /create add-on/i }))

    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Priority support', lookupKey: 'priority_support' }),
    )
  },
}

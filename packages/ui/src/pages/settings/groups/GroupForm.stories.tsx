import type { ComponentProps } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { GroupEntityType } from '@fp/domain'
import { GroupForm } from './GroupForm'

/**
 * Create a group on a compact full page. A group has three fields and no
 * update route, so this is create only.
 */
const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Settings/Groups/Group form',
  component: GroupForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Tags' }, { label: 'Create tag' }],
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof GroupForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Submits: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'EU region')
    const lookupKey = canvas.getByRole('textbox', { name: /^Lookup key/ })
    await userEvent.clear(lookupKey)
    await userEvent.type(lookupKey, 'eu-region')
    await userEvent.click(canvas.getByRole('button', { name: 'Create tag' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'EU region', lookupKey: 'eu-region' }),
    )
  },
}

export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create tag' }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    defaultValue: { name: 'EU region', lookupKey: 'eu-region', entityType: GroupEntityType.Price },
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A tag with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

/** The lookup key is filled from the name until the person types their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: /^lookup key/i })

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Acme Pro')
    await expect(field).toHaveValue('group-acme-pro')

    await userEvent.clear(field)
    await userEvent.type(field, 'mine')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), ' Plus')
    await expect(field).toHaveValue('mine')
  },
}

type PlaygroundArgs = Omit<ComponentProps<typeof GroupForm>, 'defaultValue'> & {
  name: string
  lookupKey: string
  entityType: GroupEntityType
}

/** Prefill the draft and flip submitting or a server error; the form remounts when the draft changes. */
export const Playground: StoryObj<PlaygroundArgs> = {
  parameters: { controls: { exclude: /^(trail|on[A-Z].*)$/ } },
  args: {
    name: 'EU region',
    lookupKey: 'eu-region',
    entityType: GroupEntityType.Price,
    isSubmitting: false,
    submitError: '',
  },
  argTypes: {
    name: { control: 'text' },
    lookupKey: { control: 'text' },
    entityType: { control: 'inline-radio', options: Object.values(GroupEntityType) },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text', description: 'Empty means no server error.' },
  },
  render: ({ name, lookupKey, entityType, submitError, ...rest }) => (
    <GroupForm
      key={`${name}|${lookupKey}|${entityType}`}
      {...rest}
      defaultValue={{ name, lookupKey, entityType }}
      submitError={submitError || null}
    />
  ),
}

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
  title: 'Surfaces/GroupForm',
  component: GroupForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: {
    trail: [{ label: 'Groups' }, { label: 'Create group' }],
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
    await userEvent.type(canvas.getByRole('textbox', { name: /^Lookup key/ }), 'eu-region')
    await userEvent.click(canvas.getByRole('button', { name: 'Create group' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'EU region', lookupKey: 'eu-region' }),
    )
  },
}

export const ValidationFromDomain: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create group' }))
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
  args: { submitError: 'A group with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

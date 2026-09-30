import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CostSheetForm } from './CostSheetForm'

/** Create or edit a cost sheet — the full-page body. Fixtures in, a validated draft out. */
const trail: { label: string }[] = [{ label: 'Cost sheets' }, { label: 'Create cost sheet' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'Surfaces/CostSheetForm',
  component: CostSheetForm,
  parameters: { layout: 'fullscreen' },
  decorators: [withHeight],
  args: { mode: 'create', trail, onSubmit: fn(), onCancel: fn() },
} satisfies Meta<typeof CostSheetForm>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Edit: Story = {
  args: {
    mode: 'edit',
    defaultValue: {
      name: 'Infrastructure',
      lookupKey: 'infrastructure',
      description: 'Cloud spend',
    },
  },
}

export const SubmitError: Story = {
  args: { submitError: 'A cost sheet with that lookup key already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toBeInTheDocument()
  },
}

export const ValidatesRequiredFields: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /create cost sheet/i }))
    await expect(await canvas.findByText('Enter a name')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

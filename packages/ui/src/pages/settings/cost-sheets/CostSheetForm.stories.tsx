import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CostSheetForm } from './CostSheetForm'

/** Create or edit a cost sheet: the full-page body. Fixtures in, a validated draft out. */
const trail: { label: string }[] = [{ label: 'Cost sheets' }, { label: 'Create cost sheet' }]

const withHeight: Decorator = (Story) => (
  <div className="flex h-[720px] flex-col">
    <Story />
  </div>
)

const meta = {
  title: 'App/Settings/Cost sheets/Cost sheet form',
  component: CostSheetForm,
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
} satisfies Meta<typeof CostSheetForm>

export default meta
type Story = StoryObj<typeof meta>

const editValue = {
  name: 'Infrastructure',
  lookupKey: 'infrastructure',
  description: 'Cloud spend',
}

/** Flip create/edit, submitting and a server error from the controls. */
/** The lookup key is filled from the name until the person types their own. */
export const LookupKeyFollowsName: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('textbox', { name: /^lookup key/i })

    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), 'Acme Pro')
    await expect(field).toHaveValue('cost-sheet-acme-pro')

    await userEvent.clear(field)
    await userEvent.type(field, 'mine')
    await userEvent.type(canvas.getByRole('textbox', { name: /^Name/ }), ' Plus')
    await expect(field).toHaveValue('mine')
  },
}

export const Playground: Story = {
  args: { isSubmitting: false, submitError: '' },
  render: ({ mode, submitError, ...args }) => (
    <CostSheetForm
      key={mode}
      {...args}
      mode={mode}
      submitError={submitError || null}
      {...(mode === 'edit' ? { defaultValue: editValue } : {})}
    />
  ),
}

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

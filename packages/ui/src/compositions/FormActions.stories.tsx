import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Button } from '@ui/components/primitives/button'
import { FormActions, type FormActionsProps } from './FormActions'

type PlaygroundArgs = FormActionsProps & {
  showCancel: boolean
  showBetween: boolean
  onSubmit: () => void
  onPrevious: () => void
}

function FormActionsDemo({
  showCancel,
  showBetween,
  onSubmit,
  onPrevious,
  onCancel,
  ...props
}: PlaygroundArgs) {
  return (
    <form
      className="max-w-xl rounded-xl border p-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FormActions
        {...props}
        {...(showCancel && onCancel ? { onCancel } : {})}
        {...(showBetween
          ? {
              between: (
                <Button type="button" variant="outline" onClick={onPrevious}>
                  Previous
                </Button>
              ),
            }
          : {})}
      />
    </form>
  )
}

const meta = {
  title: 'Foundation/Compositions/FormActions',
  component: FormActions,
  parameters: { layout: 'padded' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    noun: { control: 'text' },
    submitLabel: { control: 'text' },
    submitError: { control: 'text' },
    formId: { control: 'text' },
    isSubmitting: { control: 'boolean' },
    hideSubmit: { control: 'boolean' },
    showCancel: { control: 'boolean' },
    showBetween: { control: 'boolean' },
    onCancel: { control: false },
    between: { control: false },
    onSubmit: { control: false },
    onPrevious: { control: false },
  },
  args: {
    mode: 'create',
    noun: 'plan',
    submitError: '',
    isSubmitting: false,
    hideSubmit: false,
    showCancel: true,
    showBetween: false,
    onCancel: fn(),
    onSubmit: fn(),
    onPrevious: fn(),
  },
  render: (args) => <FormActionsDemo {...args} />,
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<PlaygroundArgs>

/** Switch between create and edit, set a noun or label, show an error or the submitting lock. */
export const Playground: Story = {}

/** Create names the thing it makes: "Create plan". */
export const Create: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create plan' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(args.onCancel).toHaveBeenCalledOnce()
  },
}

/** Without a noun the create label is just "Create". */
export const CreateWithoutNoun: Story = {
  args: { noun: '' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Create' })).toBeVisible()
  },
}

/** Edit always reads "Save changes". */
export const Edit: Story = {
  args: { mode: 'edit' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Save changes' })).toBeVisible()
  },
}

/** A custom `submitLabel` wins over the mode's default. */
export const CustomLabel: Story = {
  args: { submitLabel: 'Publish plan' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Publish plan' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Create plan' })).not.toBeInTheDocument()
  },
}

/** In flight: the submit says "Saving…" and both buttons lock. */
export const Submitting: Story = {
  args: { isSubmitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  },
}

/** A server error shows above the buttons as an announced alert. */
export const WithError: Story = {
  args: { submitError: 'A plan with this lookup key already exists.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'A plan with this lookup key already exists.',
    )
  },
}

/** No `onCancel`: only the submit is offered. */
export const WithoutCancel: Story = {
  args: { showCancel: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Cancel' })).toBeNull()
  },
}

/** A stepper's Previous sits between Cancel and the submit. */
export const WithStepperButtons: Story = {
  args: { showBetween: true },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Previous' }))
    await expect(args.onPrevious).toHaveBeenCalledOnce()
  },
}

/** `hideSubmit` leaves only the secondary actions, for steps that are not the last. */
export const SubmitHidden: Story = {
  args: { hideSubmit: true, showBetween: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: 'Create plan' })).toBeNull()
  },
}

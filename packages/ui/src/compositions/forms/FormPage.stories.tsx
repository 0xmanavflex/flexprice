import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Input } from '@ui/components/primitives/input'
import { FormCard, FormRow } from './FormCard'
import { FormPage, type FormPageProps } from './FormPage'
import { useFormSteps } from './useFormSteps'

/**
 * One form shell. A simple form is a centred set of fields under the pinned
 * toolbar (close, title, Create). A staged form passes `stepper`: the steps
 * are drawn in the header, and the toolbar shows Previous/Next until the last
 * step, where Create takes over. There is no footer and no preview rail. The
 * caller still owns the `<form>`, its schema and its submit handler.
 */
const meta = {
  title: 'Building blocks/Forms/FormPage',
  component: FormPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FormPage>

export default meta
type Story = StoryObj<typeof meta>

const trail = [{ label: 'Groups' }, { label: 'New group' }]

const toolbar = {
  mode: 'create',
  noun: 'group',
  formId: 'demo-form',
  onCancel: fn(),
} satisfies NonNullable<Extract<FormPageProps, { toolbar: unknown }>['toolbar']>

function Fields() {
  return (
    <FormCard>
      <FormRow label="Name" required>
        {({ id, ...field }) => <Input id={id} {...field} />}
      </FormRow>
    </FormCard>
  )
}

interface PlaygroundArgs {
  title: string
  width: 'wide' | 'narrow'
  mode: 'create' | 'edit'
  noun: string
  isSubmitting: boolean
  submitError: string
  withStepper: boolean
  stepCount: number
  unlockAll: boolean
  fieldCount: number
}

function PlaygroundPage({
  title,
  width,
  mode,
  noun,
  isSubmitting,
  submitError,
  withStepper,
  stepCount,
  unlockAll,
  fieldCount,
}: PlaygroundArgs) {
  const flow = useFormSteps({
    steps: Array.from({ length: stepCount }, (_, index) => ({
      id: `step-${index + 1}`,
      title: `Step ${index + 1}`,
      description: `Part ${index + 1} of ${stepCount}`,
    })),
    unlockAll,
  })
  return (
    <FormPage
      title={title}
      trail={trail}
      width={width}
      toolbar={{ ...toolbar, mode, noun, isSubmitting, submitError: submitError || null }}
      {...(withStepper ? { stepper: { flow, label: 'Form steps' } } : {})}
    >
      <FormCard
        title={withStepper ? (flow.steps.find((s) => s.id === flow.step)?.title ?? '') : ''}
      >
        {Array.from({ length: fieldCount }, (_, index) => (
          <FormRow key={index} label={`Field ${index + 1}`}>
            {({ id, ...field }) => <Input id={id} {...field} />}
          </FormRow>
        ))}
      </FormCard>
    </FormPage>
  )
}

/** Toggle the stepper (2-6 steps), switch width and mode, add fields, set submitting or an error. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    title: 'Create plan',
    width: 'narrow',
    mode: 'create',
    noun: 'plan',
    isSubmitting: false,
    submitError: '',
    withStepper: false,
    stepCount: 3,
    unlockAll: false,
    fieldCount: 2,
  },
  argTypes: {
    title: { control: 'text' },
    width: { control: 'inline-radio', options: ['narrow', 'wide'] },
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    noun: { control: 'text', description: 'Names the create label: "Create plan".' },
    isSubmitting: { control: 'boolean' },
    submitError: { control: 'text' },
    withStepper: { control: 'boolean' },
    stepCount: { control: { type: 'range', min: 2, max: 6, step: 1 } },
    unlockAll: { control: 'boolean', description: 'Edit mode: every step reachable.' },
    fieldCount: { control: { type: 'range', min: 1, max: 12, step: 1 } },
  },
  render: (args) => <PlaygroundPage {...args} />,
}

export const SimpleFields: Story = {
  args: { title: 'Create group', trail, toolbar, children: <Fields /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Create group' })).toBeVisible()
    await expect(canvas.queryByRole('complementary')).toBeNull()
    await expect(canvas.queryByRole('group', { name: 'Steps' })).toBeNull()
  },
}

function Staged() {
  const flow = useFormSteps({
    steps: [
      { id: 'basics', title: 'Basic info', description: 'Name it' },
      { id: 'charges', title: 'Charges', description: 'What it bills' },
      { id: 'review', title: 'Review', description: 'Check and create' },
    ],
  })
  return (
    <FormPage
      title="Create plan"
      trail={trail}
      width="wide"
      toolbar={{ ...toolbar, noun: 'plan' }}
      stepper={{ flow, label: 'Plan steps' }}
    >
      <FormCard title={flow.steps.find((s) => s.id === flow.step)?.title ?? ''}>
        <p className="text-muted-foreground px-6 py-4 text-sm">Fields for the {flow.step} step.</p>
      </FormCard>
    </FormPage>
  )
}

export const WithStepper: Story = {
  args: { title: 'Create plan', trail, toolbar, children: null },
  render: () => <Staged />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Create plan' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Previous' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: /Next/ }))
    await expect(canvas.getByRole('button', { name: 'Previous' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /Next/ }))
    await expect(canvas.queryByRole('button', { name: /Next/ })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Create plan' })).toBeVisible()
  },
}

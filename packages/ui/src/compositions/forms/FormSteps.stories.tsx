import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Input } from '@ui/components/primitives/input'
import { FormToolbar } from './FormToolbar'
import { FormSteps, useFormSteps, type FormStepDef } from './useFormSteps'

const ALL_STEPS: FormStepDef[] = [
  { id: 'details', title: 'Details', description: 'Name and type' },
  { id: 'pricing', title: 'Pricing', description: 'How it is charged' },
  { id: 'entitlements', title: 'Entitlements', description: 'What it unlocks' },
  { id: 'credits', title: 'Credits', description: 'Grants and top-ups' },
  { id: 'review', title: 'Review', description: 'Check and create' },
]

interface DemoArgs {
  stepCount: number
  /** Draw the toolbar's close (X) button; it calls `onCancel`. */
  showClose: boolean
  mode: 'create' | 'edit'
  unlockAll: boolean
  /** Make `validate` resolve false, so Next stays put. */
  blockNext: boolean
  /** Hold `step` in state the way a `?step=` search param would. */
  controlled: boolean
  isSubmitting: boolean
  submitError: string
  onSubmit: () => void
  onCancel: () => void
  onStepChange: (id: string) => void
}

const baseArgs: DemoArgs = {
  stepCount: 3,
  showClose: true,
  mode: 'create',
  unlockAll: false,
  blockNext: false,
  controlled: false,
  isSubmitting: false,
  submitError: '',
  onSubmit: fn(),
  onCancel: fn(),
  onStepChange: fn(),
}

const argTypes: Meta<DemoArgs>['argTypes'] = {
  stepCount: { control: { type: 'range', min: 2, max: 5, step: 1 } },
  showClose: {
    control: 'boolean',
    description: 'The toolbar close (X); without it there is no way back.',
  },
  mode: { control: 'inline-radio', options: ['create', 'edit'] },
  unlockAll: { control: 'boolean', description: 'Edit mode: every step reachable.' },
  blockNext: { control: 'boolean', description: '`validate` fails, so Next does not advance.' },
  controlled: { control: 'boolean', description: 'Drive `step` from state, like a search param.' },
  isSubmitting: { control: 'boolean' },
  submitError: { control: 'text' },
  onSubmit: { control: false },
  onCancel: { control: false },
  onStepChange: { control: false },
}

/** One form, one flow: the toolbar steps it, the section on screen follows the stepper, the form stays one `<form>`. */
function FlowDemo({
  stepCount,
  showClose,
  mode,
  unlockAll,
  blockNext,
  controlled,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
  onStepChange,
}: DemoArgs) {
  const steps = useMemo(() => ALL_STEPS.slice(0, stepCount), [stepCount])
  const [urlStep, setUrlStep] = useState('')
  const flow = useFormSteps({
    steps,
    unlockAll,
    validate: () => !blockNext,
    onStepChange: (id) => {
      setUrlStep(id)
      onStepChange(id)
    },
    ...(controlled ? { step: urlStep || steps[0]?.id } : {}),
  })
  const current = steps[flow.index]

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <FormToolbar
        title="New feature"
        mode={mode}
        noun="feature"
        formId="steps-demo-form"
        onCancel={showClose ? onCancel : undefined}
        isSubmitting={isSubmitting}
        onPrevious={flow.isFirst ? undefined : flow.back}
        onNext={flow.isLast ? undefined : () => void flow.next()}
        hideSubmit={!(flow.isLast || mode === 'edit')}
      />
      <form
        id="steps-demo-form"
        className="flex flex-col gap-4"
        onSubmit={flow.guardSubmit((event) => {
          event?.preventDefault()
          onSubmit()
        })}
      >
        <FormSteps flow={flow} label="Create feature">
          <div className="flex flex-col gap-3 rounded-lg border p-6">
            <label htmlFor={`field-${flow.step}`} className="text-sm font-medium">
              {current?.title} field
            </label>
            <Input id={`field-${flow.step}`} defaultValue="" />
            <p className="text-muted-foreground text-xs">
              Step {flow.index + 1} of {steps.length}
            </p>
            {controlled ? (
              <p className="text-muted-foreground font-mono text-xs">?step={flow.step}</p>
            ) : null}
          </div>
        </FormSteps>
        {submitError ? (
          <p role="alert" className="text-destructive text-sm">
            {submitError}
          </p>
        ) : null}
      </form>
    </div>
  )
}

const meta = {
  title: 'Foundation/Compositions/FormSteps',
  component: FormSteps,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FormSteps>

export default meta
type Story = StoryObj<DemoArgs>

const render: Story['render'] = (args) => <FlowDemo {...args} />

/** Every flow option as a control: steps, close button, create/edit, blocked Next, controlled step. */
export const Playground: Story = { args: baseArgs, argTypes, render }

/** First step: Next only, no Previous. */
export const FirstStep: Story = {
  args: baseArgs,
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Step 1 of 3/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeEnabled()
    await expect(canvas.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Create feature' })).not.toBeInTheDocument()
  },
}

/** Next advances, Previous goes back, and the last step offers the submit instead of Next. */
export const WalksTheFlow: Story = {
  args: baseArgs,
  argTypes,
  render,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Step 2 of 3')).toBeVisible()
    await expect(args.onStepChange).toHaveBeenCalledWith('pricing')

    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))
    await expect(await canvas.findByText('Step 1 of 3')).toBeVisible()

    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Step 2 of 3')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('Step 3 of 3')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Create feature' })).toBeEnabled()
  },
}

/** A failing `validate` keeps the person on the step. */
export const NextIsBlockedByValidation: Story = {
  args: { ...baseArgs, blockNext: true },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(canvas.getByText('Step 1 of 3')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /Step 1 of 3/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
  },
}

/** Later steps stay locked until the earlier ones have been passed. */
export const LaterStepsAreLocked: Story = {
  args: baseArgs,
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: /Step 3 of 3: Entitlements/ }),
    ).toBeDisabled()
  },
}

/** Enter in a field on a middle step advances instead of submitting the form. */
export const EnterAdvancesOnAMiddleStep: Story = {
  args: baseArgs,
  argTypes,
  render,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Details field'), 'Seats{Enter}')
    await expect(await canvas.findByText('Step 2 of 3')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Edit mode: every step is reachable and the submit is on every step. */
export const EditModeUnlocksEverything: Story = {
  args: { ...baseArgs, mode: 'edit', unlockAll: true },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: /Step 3 of 3: Entitlements/ })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: /Step 3 of 3/ }))
    await expect(await canvas.findByText('Step 3 of 3')).toBeVisible()
  },
}

/** Submitting disables the navigation and the submit says it is saving. */
export const Submitting: Story = {
  args: { ...baseArgs, isSubmitting: true, mode: 'edit', unlockAll: true },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled()
  },
}

/** A server error from the last submit is shown under the form. */
export const SubmitError: Story = {
  args: { ...baseArgs, submitError: 'A feature with this lookup key already exists.' },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'A feature with this lookup key already exists.',
    )
  },
}

/** The step is owned by the caller (a `?step=` param): the readout follows it. */
export const ControlledStep: Story = {
  args: { ...baseArgs, controlled: true },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('?step=details')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByText('?step=pricing')).toBeVisible()
  },
}

/** Without `onCancel` the toolbar draws no close (X); Previous and Next still step the flow. */
export const WithoutClose: Story = {
  args: { ...baseArgs, showClose: false },
  argTypes,
  render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Close form' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(await canvas.findByRole('button', { name: 'Previous' })).toBeVisible()
  },
}

/** The toolbar's close (X) is the way back: there is no Cancel button. */
export const CloseCallsOnCancel: Story = {
  args: baseArgs,
  argTypes,
  render,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Close form' }))
    await expect(args.onCancel).toHaveBeenCalled()
  },
}

/** Two steps only: Next, then straight to the submit. */
export const TwoSteps: Story = {
  args: { ...baseArgs, stepCount: 2 },
  argTypes,
  render,
}

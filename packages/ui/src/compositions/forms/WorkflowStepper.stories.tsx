import { useEffect, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WorkflowStepper, type WorkflowStep } from './WorkflowStepper'

/**
 * The stepper is presentational, and these stories are how that is checked.
 *
 * No router, no provider, no workflow state: every arrangement below is
 * reached by passing `steps` and `currentStep`. If proving "the user is on the
 * Prices step with Customer complete" ever required mounting a router, the
 * component would have absorbed workflow state and the rule would be broken.
 */
const steps = (currentId: string): WorkflowStep[] => {
  const order = ['customer', 'plan', 'prices', 'entitlements', 'credits', 'review']
  const titles: Record<string, string> = {
    customer: 'Customer',
    plan: 'Plan',
    prices: 'Prices',
    entitlements: 'Entitlements',
    credits: 'Credits',
    review: 'Review',
  }
  const currentIndex = order.indexOf(currentId)

  return order.map((id, index) => ({
    id,
    title: titles[id] as string,
    status:
      index < currentIndex
        ? 'complete'
        : index === currentIndex
          ? 'current'
          : index === currentIndex + 1
            ? 'upcoming'
            : 'locked',
  }))
}

const STEP_IDS = ['customer', 'plan', 'prices', 'entitlements', 'credits', 'review']

type PlaygroundArgs = Omit<ComponentProps<typeof WorkflowStepper>, 'steps' | 'children'> & {
  stepCount: number
  showContent: boolean
}

/** Statuses are derived from the current step, so clicking a reachable step moves everything. */
function LiveStepper({
  stepCount,
  showContent,
  currentStep,
  onStepChange,
  ...rest
}: PlaygroundArgs) {
  const [current, setCurrent] = useState(currentStep)
  useEffect(() => setCurrent(currentStep), [currentStep])
  const all = steps(STEP_IDS.includes(current) ? current : 'customer')
  const shown = all.slice(0, stepCount)
  const active = shown.some((s) => s.id === current) ? current : (shown[shown.length - 1]?.id ?? '')
  return (
    <WorkflowStepper
      {...rest}
      steps={shown.map((s) => ({ ...s, status: s.id === active ? 'current' : s.status }))}
      currentStep={active}
      onStepChange={(id) => {
        setCurrent(id)
        onStepChange(id)
      }}
    >
      {showContent ? <div className="rounded-lg border p-6">Step content goes here.</div> : null}
    </WorkflowStepper>
  )
}

const meta = {
  title: 'Building blocks/Forms/WorkflowStepper',
  component: WorkflowStepper,
  parameters: { layout: 'padded' },
  args: {
    steps: steps('prices'),
    currentStep: 'prices',
    onStepChange: fn(),
    children: <div className="rounded-lg border p-6">Step content goes here.</div>,
  },
  argTypes: {
    currentStep: { control: 'select', options: STEP_IDS },
    variant: { control: 'inline-radio', options: ['inline', 'header'] },
    'aria-label': { control: 'text' },
    steps: {
      control: 'object',
      description: 'Each step: id, title, status (complete, current, upcoming, locked).',
    },
    onStepChange: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof WorkflowStepper>

export default meta
type Story = StoryObj<typeof meta>

/** Pick the current step and variant; statuses follow, and clicking a reachable step navigates. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    currentStep: 'prices',
    stepCount: 6,
    variant: 'inline',
    showContent: true,
    'aria-label': 'Create plan',
    onStepChange: fn(),
  },
  argTypes: {
    stepCount: { control: { type: 'range', min: 2, max: 6, step: 1 } },
    showContent: { control: 'boolean' },
  },
  render: (args) => <LiveStepper {...args} />,
}

export const Default: Story = {}

export const FirstStep: Story = {
  args: { steps: steps('customer'), currentStep: 'customer' },
}

export const LastStep: Story = {
  args: { steps: steps('review'), currentStep: 'review' },
}

/** Earlier steps are reachable; later ones are not until they are unlocked. */
export const MixedStates: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: /Customer/ })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: /Credits.*not available yet/ })).toBeDisabled()
  },
}

/**
 * Going back reports a step *id*, not an index.
 *
 * `?step=3` breaks the moment a step is inserted and tells a reader nothing.
 * The id is what makes the URL survive the flow changing shape.
 */
export const NavigatingBackReportsAnId: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /Customer/ }))

    await expect(args.onStepChange).toHaveBeenCalledWith('customer')
  },
}

/** A locked step cannot be entered, so the page never has to re-check. */
export const LockedStepsAreNotNavigable: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /Credits/ }), {
      pointerEventsCheck: 0,
    })

    await expect(args.onStepChange).not.toHaveBeenCalled()
  },
}

/** Re-selecting the current step is not navigation, so it reports nothing. */
export const SelectingTheCurrentStepIsANoOp: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /Prices/ }))

    await expect(args.onStepChange).not.toHaveBeenCalled()
  },
}

/**
 * Walked past is not the same as filled in.
 *
 * ReUI fills every circle behind the current step, so a wizard whose earlier
 * steps collect nothing claimed they were done. Here the user is on Credits
 * and only Prices was actually completed, so Customer, Plan and Entitlements
 * must not read as finished.
 */
export const OnlyRealCompletionReadsAsDone: Story = {
  args: {
    currentStep: 'credits',
    steps: [
      { id: 'customer', title: 'Customer', status: 'upcoming' },
      { id: 'plan', title: 'Plan', status: 'upcoming' },
      { id: 'prices', title: 'Prices', status: 'complete' },
      { id: 'entitlements', title: 'Entitlements', status: 'upcoming' },
      { id: 'credits', title: 'Credits', status: 'current' },
      { id: 'review', title: 'Review', status: 'locked' },
    ],
  },
  play: async ({ canvasElement }) => {
    const circles = [...canvasElement.querySelectorAll('[data-slot="stepper-indicator"]')]
    await expect(circles).toHaveLength(6)

    const fill = (i: number) => getComputedStyle(circles[i] as Element).backgroundColor
    const done = fill(2)

    // Walked past, nothing entered: not drawn as finished.
    await expect(fill(0)).not.toBe(done)
    await expect(fill(1)).not.toBe(done)
    await expect(fill(3)).not.toBe(done)

    // Where the user is stands out as an outlined circle, and a locked step
    // is neither filled nor outlined.
    const border = (i: number) => getComputedStyle(circles[i] as Element).borderColor
    await expect(fill(4)).not.toBe(done)
    await expect(border(4)).not.toBe(border(5))
    await expect(fill(5)).not.toBe(done)
  },
}

/** The current step is announced, not merely coloured. */
export const AnnouncesPositionToScreenReaders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const current = canvas.getByRole('button', { name: /Step 3 of 6: Prices/ })
    await expect(current).toHaveAttribute('aria-current', 'step')
  },
}

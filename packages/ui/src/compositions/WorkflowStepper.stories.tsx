import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WorkflowStepper, type WorkflowStep } from './WorkflowStepper'

/**
 * The stepper is presentational, and these stories are how that is checked.
 *
 * No router, no provider, no workflow state — every arrangement below is
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

const meta = {
  title: 'Compositions/WorkflowStepper',
  component: WorkflowStepper,
  parameters: { layout: 'padded' },
  args: {
    steps: steps('prices'),
    currentStep: 'prices',
    onStepChange: fn(),
    children: <div className="rounded-lg border p-6">Step content goes here.</div>,
  },
} satisfies Meta<typeof WorkflowStepper>

export default meta
type Story = StoryObj<typeof meta>

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

    await userEvent.click(canvas.getByRole('button', { name: /Credits/ }), { pointerEventsCheck: 0 })

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

/** The current step is announced, not merely coloured. */
export const AnnouncesPositionToScreenReaders: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const current = canvas.getByRole('button', { name: /Step 3 of 6: Prices/ })
    await expect(current).toHaveAttribute('aria-current', 'step')
  },
}

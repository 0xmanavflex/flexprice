import type { WorkflowStep } from '@fp/ui/compositions'

/**
 * The subscription creation flow, and its step state.
 *
 * This lives at the page layer, not in the stepper, which is what keeps a
 * half-finished subscription deep-linkable and navigable with the back button.
 * The stepper renders whatever it is handed.
 *
 * The ids mirror the form's own steps (`SUBSCRIPTION_FORM_STEPS` in
 * `@fp/ui`): contract, charges & add-ons, commitments & benefits, billing,
 * review. The ids predate those titles and are kept for links already shared.
 */
export const SUBSCRIPTION_STEPS = [
  { id: 'plan', title: 'Contract' },
  { id: 'phases', title: 'Charges & add-ons' },
  { id: 'commitments', title: 'Commitments & benefits' },
  { id: 'billing', title: 'Billing' },
  { id: 'review', title: 'Review' },
] as const

/**
 * `?step=customer` used to be the first step and is now part of `plan`.
 *
 * Kept as a redirect rather than dropped: the old id is in people's history
 * and in any link already shared, and `parseStep` would otherwise answer an
 * honest-looking URL by silently restarting the flow.
 */
const RETIRED_STEPS: Record<string, SubscriptionStepId> = {
  customer: 'plan',
  // Benefits became "Commitments & benefits" when phases and billing got steps of their own.
  benefits: 'commitments',
}

export type SubscriptionStepId = (typeof SUBSCRIPTION_STEPS)[number]['id']

const IDS = SUBSCRIPTION_STEPS.map((s) => s.id) as readonly string[]

export const DEFAULT_STEP: SubscriptionStepId = 'plan'

/**
 * Reads the step from the URL, totally.
 *
 * An unknown or hand-edited step lands on the first one rather than throwing —
 * the same rule the invoice search params follow. A wizard that 500s on a
 * mistyped URL is worse than one that starts over.
 */
export function parseStep(raw: unknown): SubscriptionStepId {
  const value = String(raw ?? '').trim()
  if (IDS.includes(value)) return value as SubscriptionStepId
  return RETIRED_STEPS[value] ?? DEFAULT_STEP
}

export function toStepSearch(step: SubscriptionStepId): Record<string, string> {
  // The first step is the canonical `/contracts/new`, so it is not spelled out.
  return step === DEFAULT_STEP ? {} : { step }
}

/**
 * Derives each step's status from where the user is and how far they have got.
 *
 * `furthestReached` is what makes back-navigation work without letting someone
 * skip ahead: everything up to it is revisitable, the next one is reachable,
 * and the rest are locked. Deriving it here rather than storing six booleans is
 * the same instinct as deriving invoice status rather than reading three fields.
 */
export function toWorkflowSteps(
  currentStep: SubscriptionStepId,
  furthestReached: SubscriptionStepId = currentStep,
): WorkflowStep[] {
  const currentIndex = IDS.indexOf(currentStep)
  const furthestIndex = Math.max(IDS.indexOf(furthestReached), currentIndex)

  return SUBSCRIPTION_STEPS.map((step, index) => ({
    id: step.id,
    title: step.title,
    status:
      index === currentIndex
        ? 'current'
        : index < furthestIndex
          ? 'complete'
          : index === furthestIndex
            ? 'upcoming'
            : 'locked',
  }))
}

/**
 * The later of two steps.
 *
 * Progress only ever moves forward: going back to Customer must not re-lock
 * the steps already visited, or the back button becomes a trap.
 */
export function furthestOf(a: SubscriptionStepId, b: SubscriptionStepId): SubscriptionStepId {
  return IDS.indexOf(a) >= IDS.indexOf(b) ? a : b
}

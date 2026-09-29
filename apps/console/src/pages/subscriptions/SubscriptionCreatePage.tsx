import type { PriceOverride } from '@fp/domain'
import { EmptyState, type WorkflowStep, WorkflowStepper } from '@fp/ui/compositions'
import { PriceOverrideForm } from '@fp/ui/flexprice'
import { Button } from '@fp/ui/primitives'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import {
  SUBSCRIPTION_STEPS,
  type SubscriptionStepId,
  toWorkflowSteps,
} from '@/app/subscriptionSteps'

export interface SubscriptionCreatePageProps {
  step: SubscriptionStepId
  furthestReached: SubscriptionStepId
  onStepChange: (step: SubscriptionStepId) => void
  priceId: string
  override: PriceOverride | undefined
  onOverrideChange: (override: PriceOverride) => void
  onCancel: () => void
}

/**
 * Subscription creation: the workflow layer.
 *
 * Composition under test:
 *
 *     SubscriptionCreatePage   workflow + URL state
 *         -> WorkflowStepper   presentation only
 *             -> PriceStep     form state + validation
 *                 -> Domain    business invariants
 *
 * The page owns which step is active and how far the user has got. The stepper
 * is handed a list and a current id and renders them; it cannot navigate on its
 * own. The step owns its form and emits a validated domain value upward — it
 * does not know it is step three of six, and would work identically on its own
 * route.
 *
 * Five of the six steps have no form yet. That is a fact about the product, so
 * it is said to the person in front of it in their own terms — "not available
 * yet", with the flow still walkable — and never as a note to the team about
 * what proves the architecture. Two rules follow from it, and both are load
 * bearing:
 *
 * - **The flow navigates.** Back and Next sit under every step. Without them
 *   the only way between steps was hand-editing `?step=` in the address bar,
 *   which is not a wizard, it is a URL scheme.
 * - **The stepper does not claim progress that did not happen.** A step is
 *   drawn complete only when something was actually entered into it, not
 *   because the person walked past it. See `toSteps`.
 */
export function SubscriptionCreatePage({
  step,
  furthestReached,
  onStepChange,
  priceId,
  override,
  onOverrideChange,
  onCancel,
}: SubscriptionCreatePageProps) {
  const index = SUBSCRIPTION_STEPS.findIndex((entry) => entry.id === step)
  const current = SUBSCRIPTION_STEPS[index]
  const previous = index > 0 ? SUBSCRIPTION_STEPS[index - 1] : undefined
  const next = SUBSCRIPTION_STEPS[index + 1]

  // Prices is the only step that collects anything today, so it is the only one
  // that can be complete. When the rest land, each adds its own condition here.
  const completed = new Set<SubscriptionStepId>(override ? ['prices'] : [])

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-8 overflow-y-auto p-6">
      <h1 className="text-xl font-semibold">New subscription</h1>

      <WorkflowStepper
        steps={toSteps(step, furthestReached, completed)}
        currentStep={step}
        onStepChange={(id) => onStepChange(id as SubscriptionStepId)}
        aria-label="Subscription setup"
      >
        <div className="flex flex-col gap-8">
          {step === 'prices' ? (
            <div className="flex flex-col gap-6">
              {/*
                `onCancel` is deliberately not passed down: leaving the whole
                flow is a wizard-level action and lives in the footer below,
                so the step shows one button ("Save override") rather than a
                second Cancel three inches above the first.
              */}
              <PriceOverrideForm
                priceId={priceId}
                {...(override ? { defaultValue: override } : {})}
                onSubmit={onOverrideChange}
              />

              {override ? (
                <p role="status" className="text-muted-foreground text-sm">
                  This override is saved to the draft and will be applied when the subscription is
                  created.
                </p>
              ) : null}
            </div>
          ) : (
            <UnbuiltStep title={current?.title ?? 'This step'} />
          )}

          <WizardFooter
            {...(previous ? { onBack: () => onStepChange(previous.id) } : {})}
            {...(next ? { onNext: () => onStepChange(next.id) } : {})}
            onCancel={onCancel}
          />
        </div>
      </WorkflowStepper>
    </main>
  )
}

/**
 * The stepper's step state, corrected to what was actually entered.
 *
 * `toWorkflowSteps` derives status from position: everything before the
 * furthest step reached counts as complete. That is right for *reachability* —
 * a step you have been to is a step you may go back to — and wrong as a claim
 * about progress. Opening `?step=credits` used to draw Customer, Plan and
 * Prices as filled, finished circles when not one field had been filled in,
 * which is the interface telling the user something untrue about their own
 * work.
 *
 * So position still decides what is reachable and what is locked, and a
 * separate set decides what is *done*. A step that was walked past but never
 * filled in falls back to `upcoming`: visitable, plainly not finished.
 */
function toSteps(
  step: SubscriptionStepId,
  furthestReached: SubscriptionStepId,
  completed: ReadonlySet<SubscriptionStepId>,
): WorkflowStep[] {
  return toWorkflowSteps(step, furthestReached).map((entry) =>
    entry.status === 'complete' && !completed.has(entry.id as SubscriptionStepId)
      ? { ...entry, status: 'upcoming' as const }
      : entry,
  )
}

/**
 * Back / Cancel / Next, under every step.
 *
 * Back is omitted rather than disabled on the first step — a control that can
 * never do anything is noise, and a disabled button still takes a tab stop.
 */
function WizardFooter({
  onBack,
  onNext,
  onCancel,
}: {
  onBack?: () => void
  onNext?: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
      <div>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeftIcon aria-hidden className="size-4" />
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {onNext ? (
          <Button type="button" onClick={onNext}>
            Next
            <ArrowRightIcon aria-hidden className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A step that has no form yet, said to the person using it.
 *
 * What used to render here was a note to the team — "Only Prices is
 * implemented — it is the step that proves the architecture" — shipped to a
 * live console. This says the same thing in the reader's terms: the step is not
 * available, the flow still works, and here is where to go instead.
 */
function UnbuiltStep({ title }: { title: string }) {
  return (
    <EmptyState
      size="inline"
      title={`${title} is not available yet`}
      description="This part of subscription setup is still being built. You can move through the flow with Back and Next — Prices is the step you can fill in today."
    />
  )
}

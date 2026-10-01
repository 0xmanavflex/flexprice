import type { PriceOverride } from '@fp/domain'
import {
  EmptyState,
  FormPage,
  type WorkflowStep,
  WorkflowStepper,
} from '@fp/ui/compositions'
import { PriceOverrideForm } from '@fp/ui/pages'
import { Button, Card, CardContent } from '@fp/ui/primitives'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { useRef } from 'react'
import {
  SUBSCRIPTION_STEPS,
  type SubscriptionStepId,
  toWorkflowSteps,
} from '@/app/subscriptionSteps'

const PRICE_FORM_ID = 'subscription-price-override'

export interface SubscriptionCreatePageProps {
  step: SubscriptionStepId
  furthestReached: SubscriptionStepId
  onStepChange: (step: SubscriptionStepId) => void
  priceId: string
  override: PriceOverride | undefined
  onOverrideChange: (override: PriceOverride) => void
  onCancel: () => void
  /**
   * Render inside another page (a customer's Subscriptions section) instead of
   * as a page of its own: no `<main>` or heading, the Customer step dropped
   * because the customer is already known, and the last step offers
   * "Create Subscription" (`onCreate`).
   */
  embedded?: boolean
  onCreate?: () => void
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
  embedded = false,
  onCreate,
}: SubscriptionCreatePageProps) {
  const steps = embedded
    ? SUBSCRIPTION_STEPS.filter((entry) => entry.id !== 'customer')
    : SUBSCRIPTION_STEPS
  const index = steps.findIndex((entry) => entry.id === step)
  const current = steps[index]
  const previous = index > 0 ? steps[index - 1] : undefined
  const next = steps[index + 1]

  // Prices is the only step that collects anything today, so it is the only one
  // that can be complete. When the rest land, each adds its own condition here.
  const completed = new Set<SubscriptionStepId>(override ? ['prices'] : [])
  // The prices step is optional. Next saves only after an amount or a tier is
  // entered; a blank step just moves on.
  const priceStarted = useRef(false)

  const flow = (
    <WorkflowStepper
      steps={toSteps(step, furthestReached, completed).filter((entry) =>
        steps.some((kept) => kept.id === entry.id),
      )}
      currentStep={step}
      onStepChange={(id) => onStepChange(id as SubscriptionStepId)}
      aria-label="Subscription setup"
    >
      {step === 'prices' ? (
        <div className="flex flex-col gap-6">
          {/*
            The wizard footer is the only action row. Next submits this form
            once something has been entered; Cancel leaves the whole flow.
          */}
          <PriceOverrideForm
            priceId={priceId}
            formId={PRICE_FORM_ID}
            hideActions
            onStartedChange={(started) => {
              priceStarted.current = started
            }}
            {...(override ? { defaultValue: override } : {})}
            onSubmit={(value) => {
              onOverrideChange(value)
              if (next) onStepChange(next.id)
            }}
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
    </WorkflowStepper>
  )

  const footer = (
    <WizardFooter
      {...(previous ? { onBack: () => onStepChange(previous.id) } : {})}
      {...(next
        ? {
            onNext: () => {
              if (step === 'prices' && priceStarted.current) {
                const form = document.getElementById(PRICE_FORM_ID)
                if (form instanceof HTMLFormElement) form.requestSubmit()
                return
              }
              onStepChange(next.id)
            },
          }
        : {})}
      {...(embedded && !next && onCreate ? { onCreate } : {})}
      onCancel={onCancel}
    />
  )

  if (embedded) {
    return (
      <Card className="gap-0 p-0 shadow-xs">
        <CardContent className="flex flex-col gap-6 px-5 py-5 sm:px-6 sm:py-6">
          {flow}
          {footer}
        </CardContent>
      </Card>
    )
  }

  return (
    <FormPage
      title="New subscription"
      description="Put a customer on a plan. Prices is the step you can fill in today; the other steps are still being built."
      trail={[
        { label: 'Subscriptions', onClick: onCancel },
        { label: 'New subscription' },
      ]}
      width="narrow"
      footer={footer}
    >
      {flow}
    </FormPage>
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
  onCreate,
  onCancel,
}: {
  onBack?: () => void
  onNext?: () => void
  onCreate?: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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
        {onCreate ? (
          <Button type="button" onClick={onCreate}>
            Create Subscription
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

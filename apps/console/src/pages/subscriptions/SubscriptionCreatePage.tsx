import type { PriceOverride } from '@fp/domain'
import { toOverrideLineItem } from '@fp/query'
import { WorkflowStepper } from '@fp/ui/compositions'
import { PriceOverrideForm } from '@fp/ui/flexprice'
import {
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
 * Five of the six steps are placeholders. The milestone is proving the
 * composition, not building the wizard.
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
  return (
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-8 overflow-y-auto p-6">
      <h1 className="text-xl font-semibold">New subscription</h1>

      <WorkflowStepper
        steps={toWorkflowSteps(step, furthestReached)}
        currentStep={step}
        onStepChange={(id) => onStepChange(id as SubscriptionStepId)}
        aria-label="Subscription setup"
      >
        {step === 'prices' ? (
          <div className="flex flex-col gap-6">
            <PriceOverrideForm
              priceId={priceId}
              {...(override ? { defaultValue: override } : {})}
              onSubmit={onOverrideChange}
              onCancel={onCancel}
            />

            {override ? (
              <section aria-labelledby="payload-heading" className="flex flex-col gap-2">
                <h3 id="payload-heading" className="text-sm font-medium">
                  Will be submitted with the subscription
                </h3>
                {/*
                  There is no standalone price-override endpoint —
                  `overrideLineItems` exists only on CreateSubscriptionRequest.
                  So the step collects a value and the wizard submits it. This
                  is the mapped transport shape, shown because it is the proof
                  that domain -> query -> API runs without the form knowing any
                  of it.
                */}
                <pre className="overflow-auto rounded-lg border p-3 text-xs">
                  {JSON.stringify(toOverrideLineItem(override), null, 2)}
                </pre>
              </section>
            ) : null}
          </div>
        ) : (
          <Placeholder step={step} />
        )}
      </WorkflowStepper>
    </main>
  )
}

/** Honest about what is not built, rather than a convincing empty screen. */
function Placeholder({ step }: { step: SubscriptionStepId }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      The <span className="font-medium">{step}</span> step is not built yet. Only{' '}
      <span className="font-medium">Prices</span> is implemented — it is the step that proves the
      architecture.
    </div>
  )
}

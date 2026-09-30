import { useState } from 'react'
import type { PriceOverride } from '@fp/domain'
import { type SubscriptionStepId, furthestOf } from '@/app/subscriptionSteps'
import { SubscriptionCreatePage } from './SubscriptionCreatePage'

export interface CustomerSubscriptionCreateProps {
  onCancel: () => void
  /** Called on "Create Subscription"; the caller refetches and closes the form. */
  onCreated: () => void
}

/**
 * The subscription flow, embedded in a customer's Subscriptions section.
 *
 * The same `SubscriptionCreatePage` the top-level `/subscriptions/new` route
 * renders, minus the Customer step (the customer is where the person already
 * is). Step and draft state are local here: leaving the section discards them,
 * while the tab and the customer around it never unmount.
 */
export function CustomerSubscriptionCreate({
  onCancel,
  onCreated,
}: CustomerSubscriptionCreateProps) {
  const [step, setStep] = useState<SubscriptionStepId>('plan')
  const [furthest, setFurthest] = useState<SubscriptionStepId>('plan')
  const [override, setOverride] = useState<PriceOverride>()

  const goTo = (next: SubscriptionStepId) => {
    setFurthest((current) => furthestOf(current, next))
    setStep(next)
  }

  return (
    <SubscriptionCreatePage
      embedded
      step={step}
      furthestReached={furthest}
      onStepChange={goTo}
      priceId="price_01"
      override={override}
      onOverrideChange={(value) => {
        setOverride(value)
        goTo('entitlements')
      }}
      onCancel={onCancel}
      onCreate={onCreated}
    />
  )
}

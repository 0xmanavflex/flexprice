import { useState } from 'react'
import { ApiError, useCustomer } from '@fp/query'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'
import { SubscriptionFormPage } from './SubscriptionFormPage'

export interface CustomerSubscriptionFormPageProps {
  customerId: string
  onCancel: () => void
}

/**
 * New subscription for one customer, on its own page.
 *
 * The customer id is the route param, so the Customer step is dropped. The step
 * is local: leaving the page discards it, and a created subscription returns to
 * the customer.
 */
export function CustomerSubscriptionFormPage({
  customerId,
  onCancel,
}: CustomerSubscriptionFormPageProps) {
  const customer = useCustomer(customerId)
  const [step, setStep] = useState('plan')

  if (customer.isPending) {
    return (
      <div className="p-6">
        <LoadingRows />
      </div>
    )
  }

  if (customer.error || !customer.data) {
    return (
      <PageBody>
        <AppFailure
          title={customer.error ? failureTitle(customer.error) : 'This customer no longer exists'}
          detail="Go back to the customer and try again."
          onRetry={onCancel}
        />
      </PageBody>
    )
  }

  return (
    <SubscriptionFormPage
      customerId={customer.data.id}
      step={step}
      onStepChange={setStep}
      onCancel={onCancel}
      onDone={onCancel}
    />
  )
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'network') return 'Could not reach Flexprice'
  return 'This customer could not be loaded'
}

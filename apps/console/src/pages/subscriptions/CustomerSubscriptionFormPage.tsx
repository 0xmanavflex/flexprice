import { DEFAULT_PLAN_QUERY } from '@fp/domain'
import { ApiError, useCustomer, usePlans } from '@fp/query'
import { SubscriptionForm, toast } from '@fp/ui/pages'
import { AppFailure, LoadingRows, PageBody } from '@fp/ui/compositions'

export interface CustomerSubscriptionFormPageProps {
  customerId: string
  onCancel: () => void
}

/**
 * New subscription for one customer, on its own page.
 *
 * The customer id is the route param, so the form does not ask who this is for.
 * Plans are the published catalogue. Saving a subscription has no API in this
 * build, so submit says so instead of pretending a record was created.
 */
export function CustomerSubscriptionFormPage({
  customerId,
  onCancel,
}: CustomerSubscriptionFormPageProps) {
  const customer = useCustomer(customerId)
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, pageSize: 100 })

  if (customer.isPending || plans.isPending) {
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

  const record = customer.data

  return (
    <SubscriptionForm
      customerId={record.id}
      customerName={record.name}
      plans={(plans.data?.plans ?? []).map((plan) => ({ id: plan.id, name: plan.name }))}
      trail={[
        { label: 'Customers', onClick: onCancel },
        { label: record.name, onClick: onCancel },
        { label: 'New subscription' },
      ]}
      onCancel={onCancel}
      submitError={plans.error ? 'Plans could not be loaded. The rest of the form still works.' : null}
      onSubmit={() => {
        toast.info('Saving a subscription is not available yet.')
      }}
    />
  )
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'network') return 'Could not reach Flexprice'
  return 'This customer could not be loaded'
}

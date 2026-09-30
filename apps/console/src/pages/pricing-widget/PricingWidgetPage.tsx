import { DEFAULT_PLAN_QUERY, PlanStatus } from '@fp/domain'
import { ApiError, usePlans } from '@fp/query'
import { PricingWidget } from '@fp/ui/flexprice'
import { PageBody, PageHeader } from '@fp/ui/compositions'

const QUERY = { ...DEFAULT_PLAN_QUERY, pageSize: 100, statuses: [PlanStatus.Published] }

/** The wiring layer: published plans in, the pricing-table preview out. */
export function PricingWidgetPage() {
  const plans = usePlans(QUERY)
  const failure = toFailure(plans.error)

  return (
    <>
      <PageHeader
        title="Pricing Widget"
        description="A preview of the pricing table your customers choose a plan from."
      />
      <PageBody>
        <PricingWidget
          plans={plans.data?.plans ?? []}
          isLoading={plans.isPending}
          error={failure?.message ?? null}
          {...(failure?.canRetry ? { onRetry: () => void plans.refetch() } : {})}
        />
      </PageBody>
    </>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to plans here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading plans.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading plans.', canRetry: true }
}

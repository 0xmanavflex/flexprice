import { DEFAULT_PLAN_QUERY } from '@fp/domain'
import { usePlanEntitlements, usePlans } from '@fp/query'
import { PricingCatalogBlock } from '@fp/ui/pages'

export interface PricingWidgetPageProps {
  onCreatePlan: () => void
  onEditPlan: (planId: string) => void
}

export function PricingWidgetPage({ onCreatePlan, onEditPlan }: PricingWidgetPageProps) {
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, pageSize: 100 })

  const planList = plans.data?.plans ?? []
  const entitlements = usePlanEntitlements(planList.map((plan) => plan.id))

  return (
    <PricingCatalogBlock
      plans={planList}
      entitlements={entitlements.data ?? []}
      loading={plans.isPending}
      onCreatePlan={onCreatePlan}
      onEditPlan={onEditPlan}
    />
  )
}

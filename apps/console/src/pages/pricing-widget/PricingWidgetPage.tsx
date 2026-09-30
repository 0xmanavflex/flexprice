import { DEFAULT_PLAN_QUERY } from '@fp/domain'
import { usePlans } from '@fp/query'
import { PricingCatalogBlock } from '@fp/ui/pages'
import { PageBody, PageHeader } from '@fp/ui/compositions'

export interface PricingWidgetPageProps {
  onCreatePlan: () => void
  onEditPlan: (planId: string) => void
}

export function PricingWidgetPage({ onCreatePlan, onEditPlan }: PricingWidgetPageProps) {
  const plans = usePlans({ ...DEFAULT_PLAN_QUERY, pageSize: 100 })

  return (
    <>
      <PageHeader
        title="Pricing Widget"
        description="The plan catalogue your customers choose from."
      />
      <PageBody>
      <PricingCatalogBlock
        plans={plans.data?.plans ?? []}
        onCreatePlan={onCreatePlan}
        onEditPlan={onEditPlan}
      />
      </PageBody>
    </>
  )
}

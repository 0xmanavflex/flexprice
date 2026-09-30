import { Toaster } from 'sonner'
import type { Plan as PlanRecord } from '@fp/domain'
import { PlanStatus } from '@fp/domain'
import { Page, type Plan } from '@ui/components/blocks/solution-billing-2/page'

/** ReUI `solution-billing-2`, fed the real plan catalogue. */
export interface PricingCatalogBlockProps {
  plans: PlanRecord[]
  onCreatePlan: () => void
  onEditPlan: (planId: string) => void
}

function toTile(plan: PlanRecord): Plan {
  const amount = Number((plan.headline?.amount ?? '').replace(/[^0-9.]/g, '')) || 0
  const yearly = /year|annual/i.test(plan.headline?.period ?? '')
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status === PlanStatus.Published ? 'active' : 'archived',
    isPublic: true,
    monthlyPrice: yearly ? Math.round(amount / 12) : amount,
    annualPrice: yearly ? amount : amount * 12,
    perSeat: false,
    entitlements: [],
    addOns: [],
  }
}

export function PricingCatalogBlock({ plans, onCreatePlan, onEditPlan }: PricingCatalogBlockProps) {
  return (
    <>
      <Page plans={plans.map(toTile)} onCreatePlan={onCreatePlan} onEditPlan={onEditPlan} />
      <Toaster />
    </>
  )
}

import { Toaster } from 'sonner'
import { FeatureType, PlanStatus, type Entitlement, type Plan as PlanRecord } from '@fp/domain'
import { ZapIcon } from 'lucide-react'
import { Page, type Plan } from '@ui/components/blocks/solution-billing-2/page'

/** ReUI `solution-billing-2`, fed the real plan catalogue. */
export interface PricingCatalogBlockProps {
  plans: PlanRecord[]
  entitlements: Entitlement[]
  onCreatePlan: () => void
  onEditPlan: (planId: string) => void
}

function describe(e: Entitlement): string {
  switch (e.featureType) {
    case FeatureType.Metered:
      return e.usageLimit === null ? 'Unlimited' : e.usageLimit.toLocaleString()
    case FeatureType.Static:
      return e.staticValue ?? '—'
    case FeatureType.Boolean:
      return e.isEnabled ? 'Included' : 'Off'
    default:
      return 'Custom'
  }
}

function toTile(plan: PlanRecord, entitlements: Entitlement[]): Plan {
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
    entitlements: entitlements
      .filter((e) => e.entityId === plan.id)
      .map((e) => ({
        id: e.id,
        icon: <ZapIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />,
        label: e.featureName ?? 'Feature',
        value: describe(e),
      })),
    addOns: [],
  }
}

export function PricingCatalogBlock({ plans, entitlements, onCreatePlan, onEditPlan }: PricingCatalogBlockProps) {
  return (
    <>
      <Page plans={plans.map((plan) => toTile(plan, entitlements))} onCreatePlan={onCreatePlan} onEditPlan={onEditPlan} />
      <Toaster />
    </>
  )
}

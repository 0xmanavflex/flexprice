import { useMemo, useState } from 'react'
import {
  DEFAULT_PLAN_QUERY,
  PlanStatus,
  PriceEntityType,
  defaultPricingSelection,
  pricingCards,
  pricingOptions,
  type PricingSelection,
} from '@fp/domain'
import { useEntitiesCharges, usePlanEntitlements, usePlans, usePlansCreditGrants } from '@fp/query'
import { PricingCatalogBlock } from '@fp/ui/pages'

export interface PricingWidgetPageProps {
  onViewPlan: (planId: string) => void
}

/**
 * The pricing widget, as V1 shows it: published plans, priced in the chosen
 * billing period and currency, with what each includes and the credits it
 * grants. Four reads in all: plans, then their charges, entitlements and
 * credit grants in one request each.
 */
export function PricingWidgetPage({ onViewPlan }: PricingWidgetPageProps) {
  const plansQuery = usePlans({
    ...DEFAULT_PLAN_QUERY,
    statuses: [PlanStatus.Published],
    pageSize: 100,
  })
  const plans = useMemo(
    () => (plansQuery.data?.plans ?? []).filter((plan) => plan.status === PlanStatus.Published),
    [plansQuery.data],
  )
  const planIds = useMemo(() => plans.map((plan) => plan.id), [plans])

  const charges = useEntitiesCharges(PriceEntityType.Plan, planIds)
  const entitlements = usePlanEntitlements(planIds)
  const creditGrants = usePlansCreditGrants(planIds)

  const chargesByPlan = charges.data
  const options = useMemo(
    () => (chargesByPlan ? pricingOptions(chargesByPlan) : { periods: [], currencies: [] }),
    [chargesByPlan],
  )
  const [chosen, setChosen] = useState<PricingSelection | null>(null)
  // Until someone picks, open on the period and currency that show the most plans.
  const selection = useMemo(
    () => chosen ?? (chargesByPlan ? defaultPricingSelection(chargesByPlan) : null),
    [chosen, chargesByPlan],
  )

  const cards = useMemo(
    () =>
      chargesByPlan && selection
        ? pricingCards({
            plans,
            chargesByPlan,
            entitlements: entitlements.data ?? [],
            creditGrantsByPlan: creditGrants.data ?? new Map(),
            selection,
          })
        : [],
    [plans, chargesByPlan, entitlements.data, creditGrants.data, selection],
  )

  return (
    <PricingCatalogBlock
      cards={cards}
      periods={options.periods}
      currencies={options.currencies}
      selection={selection}
      onSelectionChange={setChosen}
      loading={plansQuery.isPending || (planIds.length > 0 && charges.isPending)}
      hasPlans={plans.length > 0}
      onViewPlan={onViewPlan}
    />
  )
}

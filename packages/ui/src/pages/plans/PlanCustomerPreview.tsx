import { type Charge, type CreditGrant, type Entitlement, chargeToDraft } from '@fp/domain'
import { PlanPreviewCard, creditLine, includedLine } from './PlanPreviewCard'

export interface PlanCustomerPreviewProps {
  name: string
  charges: Charge[]
  entitlements: Entitlement[]
  grants: CreditGrant[]
  trialDays?: number | null | undefined
}

/**
 * "What customers see" for a saved plan: adapts the plan's persisted charges,
 * entitlements and grants to `PlanPreviewCard`, the one preview the form shares.
 */
export function PlanCustomerPreview({
  name,
  charges,
  entitlements,
  grants,
  trialDays,
}: PlanCustomerPreviewProps) {
  const meterNames = new Map(charges.map((c) => [c.meterId, c.meterName] as const))
  return (
    <PlanPreviewCard
      name={name}
      charges={charges.map(chargeToDraft)}
      meterLabel={(id) => meterNames.get(id) ?? id}
      trialDays={trialDays}
      included={entitlements.map((e) =>
        includedLine({ ...e, key: e.id, name: e.featureName ?? e.featureId }),
      )}
      credits={grants.map((g) => creditLine({ ...g, key: g.id }))}
    />
  )
}

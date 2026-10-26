import {
  type Charge,
  type CreditGrant,
  type Entitlement,
  chargeToDraft,
  meteredAllowance,
} from '@fp/domain'
import { PlanPreviewCard, creditLine, includedLine } from './PlanPreviewCard'

export interface PlanCustomerPreviewProps {
  charges: Charge[]
  entitlements: Entitlement[]
  grants: CreditGrant[]
  trialDays?: number | null | undefined
  /** Singular unit of a meter ("call"), for "per call" wording. */
  meterUnit?: (meterId: string) => string | undefined
  /** Plural unit of a feature ("tokens"), shown after a metered allowance. */
  featureUnit?: (featureId: string) => string | undefined
  className?: string
  onJump?: ((target: string) => void) | undefined
}

/**
 * Where each block of the preview jumps to.
 *
 * `Section` derives its heading id from its title, so these are the ids of
 * the Charges, Entitlements and Credit grants tables stacked beside this.
 */
const JUMP_TARGETS = {
  charges: 'section-charges',
  included: 'section-entitlements',
  credits: 'section-credit-grants',
} as const

/**
 * "What customers see" for a saved plan: adapts the plan's persisted charges,
 * entitlements and grants to `PlanPreviewCard`, the one preview the form shares.
 */
export function PlanCustomerPreview({
  charges,
  entitlements,
  grants,
  trialDays,
  meterUnit,
  featureUnit,
  className,
  onJump,
}: PlanCustomerPreviewProps) {
  const meterNames = new Map(charges.map((c) => [c.meterId, c.meterName] as const))
  return (
    <PlanPreviewCard
      // A saved plan's preview is a pricing card, not a form rail.
      variant="card"
      jumpTargets={JUMP_TARGETS}
      onJump={onJump}
      {...(className ? { className } : {})}
      charges={charges.map(chargeToDraft)}
      meterLabel={(id) => meterNames.get(id) ?? id}
      {...(meterUnit ? { meterUnit } : {})}
      trialDays={trialDays}
      included={entitlements.map((e) =>
        includedLine({
          ...e,
          // A grant's quota, when it has one; the usage limit is empty then.
          usageLimit: meteredAllowance(e) === null ? null : Number(meteredAllowance(e)),
          key: e.id,
          name: e.featureName ?? e.featureId,
          unit: featureUnit?.(e.featureId),
        }),
      )}
      credits={grants.map((g) => creditLine({ ...g, key: g.id }))}
    />
  )
}

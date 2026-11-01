import { type Charge, type CreditGrant, type Entitlement, pricingPreview } from '@fp/domain'
import { PricingPlanCard, type PricingPlanSection } from '../pricing-widget/PricingPlanCard'

export interface PlanCustomerPreviewProps {
  plan: { id: string; name: string; description: string }
  charges: Charge[]
  entitlements: Entitlement[]
  grants: CreditGrant[]
  className?: string
  /** A section heading jumps to its table (an id from `JUMP_TARGETS`). */
  onJump?: ((target: string) => void) | undefined
}

/**
 * Where each heading of the preview jumps to.
 *
 * `Section` derives its heading id from its title, so these are the ids of
 * the Charges, Entitlements and Credit grants tables stacked beside this.
 */
const JUMP_TARGETS: Record<PricingPlanSection, string> = {
  price: 'section-charges',
  usage: 'section-charges',
  oneTime: 'section-charges',
  included: 'section-entitlements',
  credits: 'section-credit-grants',
}

/**
 * "What customers see" for a saved plan: the plan as V1's pricing card shows
 * it, in preview mode (its usage charges, every line, no View plan), worked
 * out the way the pricing widget works it out, so the two never disagree.
 */
export function PlanCustomerPreview({
  plan,
  charges,
  entitlements,
  grants,
  className,
  onJump,
}: PlanCustomerPreviewProps) {
  const preview = pricingPreview({ plan, charges, entitlements, creditGrants: grants })
  return (
    <aside aria-label="Plan preview" className={className}>
      <p className="text-muted-foreground mb-2 text-xs">What customers see</p>
      {preview ? (
        <PricingPlanCard
          preview
          name={preview.name}
          price={preview.price}
          per={preview.per}
          hasUsage={preview.hasUsage}
          usage={preview.usage.map((line) => ({ ...line, key: line.id }))}
          oneTime={preview.oneTime.map((line) => ({ ...line, key: line.id }))}
          included={preview.included.map((line) => ({ ...line, key: line.id }))}
          credits={preview.credits.map((line) => ({ ...line, key: line.id }))}
          sectionHref={(section) => `#${JUMP_TARGETS[section]}`}
          {...(onJump ? { onSection: (section) => onJump(JUMP_TARGETS[section]) } : {})}
        />
      ) : (
        <div className="text-muted-foreground rounded-2xl border p-5 text-[13px]/relaxed">
          Add a charge and the price customers see builds up here.
        </div>
      )}
    </aside>
  )
}

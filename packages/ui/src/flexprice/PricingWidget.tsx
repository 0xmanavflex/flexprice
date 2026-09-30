import { BILLING_PERIOD_SHORT, type Plan } from '@fp/domain'
import { Badge } from '@ui/components/reui/badge'
import { Frame, FrameFooter, FramePanel } from '@ui/components/reui/frame'
import { ErrorState } from '@ui/compositions/States'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@ui/primitives/item'
import { Skeleton } from '@ui/primitives/skeleton'
import { provenance } from '@ui/provenance'

/**
 * A preview of the embeddable pricing table: one ReUI `Frame` card per
 * published plan, headline price first, as customers would choose from.
 */
export const PricingWidgetProvenance = provenance({
  source: 'composition',
  composes: ['reui/frame', 'ui/item', 'reui/badge'],
  note: 'Pricing-table preview over published plans.',
})

const PERIOD_SHORT: Record<string, string | undefined> = BILLING_PERIOD_SHORT

function headlinePrice(plan: Plan): string | null {
  if (!plan.headline) return null
  const short = PERIOD_SHORT[plan.headline.period]
  return short ? `${plan.headline.amount} /${short}` : plan.headline.amount
}

export interface PricingWidgetProps {
  plans: Plan[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function PricingWidget({
  plans,
  isLoading = false,
  error = null,
  onRetry,
}: PricingWidgetProps) {
  if (error) {
    return (
      <ErrorState
        title="Couldn't load plans"
        description={error}
        {...(onRetry ? { onRetry } : {})}
      />
    )
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        <span className="sr-only">Loading plans</span>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }
  if (plans.length === 0) {
    return (
      <ErrorState
        title="No published plans"
        description="Publish a plan and it appears in the pricing table your customers see."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Frame key={plan.id} data-testid={`pricing-plan-${plan.id}`}>
          <FramePanel>
            <Item className="p-0">
              <ItemContent>
                <ItemTitle>{plan.name}</ItemTitle>
                <p className="text-2xl font-semibold">{headlinePrice(plan) ?? 'Usage-based'}</p>
              </ItemContent>
            </Item>
            {plan.description ? (
              <ItemDescription className="mt-3 line-clamp-none">{plan.description}</ItemDescription>
            ) : null}
          </FramePanel>
          <FrameFooter role="group" aria-label={`${plan.name} plan details`}>
            <Badge variant="outline">
              {plan.chargeCount} {plan.chargeCount === 1 ? 'charge' : 'charges'}
            </Badge>
          </FrameFooter>
        </Frame>
      ))}
    </div>
  )
}

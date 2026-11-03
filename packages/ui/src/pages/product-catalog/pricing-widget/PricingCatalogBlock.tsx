import type { PricingCard, PricingOption, PricingSelection } from '@fp/domain'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { PageBody, PageHeader } from '@ui/compositions/layout/Page'
import { provenance } from '@ui/provenance'
import { PricingPlanCard } from './PricingPlanCard'

export const PricingCatalogBlockProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Page',
    'compositions/forms/OptionSelect',
    'pages/product-catalog/pricing-widget/PricingPlanCard',
  ],
  note: 'The pricing widget, as V1 shows it: a billing-period and currency picker, then V1’s pricing card per plan priced in them, with its fee, View plan, what it includes and the credits it grants.',
})

/**
 * The pricing widget page: the published plans as a pricing page would show
 * them, for one billing period and one currency at a time.
 *
 * Presentational only. The cards, the options and the default selection are
 * worked out in `@fp/domain` (`pricingWidget.ts`); the console page fetches.
 */
export interface PricingCatalogBlockProps {
  cards: readonly PricingCard[]
  periods: readonly PricingOption[]
  currencies: readonly PricingOption[]
  /** Null until there is a priced plan to pick a period and currency from. */
  selection: PricingSelection | null
  onSelectionChange: (next: PricingSelection) => void
  /** True while plans or their prices are loading. */
  loading?: boolean
  /** Whether any published plan exists at all, priced or not. */
  hasPlans: boolean
  onViewPlan: (planId: string) => void
}

export function PricingCatalogBlock({
  cards,
  periods,
  currencies,
  selection,
  onSelectionChange,
  loading = false,
  hasPlans,
  onViewPlan,
}: PricingCatalogBlockProps) {
  const pickers =
    selection && (periods.length > 0 || currencies.length > 0) ? (
      <>
        <div className="w-40 sm:w-52">
          <label htmlFor="pricing-widget-period" className="sr-only">
            Billing period
          </label>
          <OptionSelect
            id="pricing-widget-period"
            value={selection.period}
            options={periods}
            onValueChange={(period) => onSelectionChange({ ...selection, period })}
          />
        </div>
        <div className="w-32 sm:w-52">
          <label htmlFor="pricing-widget-currency" className="sr-only">
            Currency
          </label>
          <OptionSelect
            id="pricing-widget-currency"
            value={selection.currency}
            options={currencies}
            onValueChange={(currency) => onSelectionChange({ ...selection, currency })}
          />
        </div>
      </>
    ) : null

  return (
    <>
      <PageHeader title="Pricing widgets" {...(pickers ? { actions: pickers } : {})} />
      <PageBody>
        {loading ? (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-busy="true"
            aria-label="Loading plans"
          >
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : !hasPlans ? (
          <EmptyState
            scene="catalog"
            title="No plans to show yet"
            description="Publish a plan and it appears here, as your pricing page would show it."
          />
        ) : cards.length === 0 ? (
          <EmptyState
            scene="catalog"
            title="No plans priced here"
            description={
              selection
                ? 'No published plan has a charge in this billing period and currency. Choose another.'
                : 'Add charges to a published plan and it appears here.'
            }
          />
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <PricingPlanCard
                key={card.planId}
                name={card.name}
                description={card.description}
                price={card.price}
                per={card.per}
                hasUsage={card.hasUsage}
                included={card.included.map((line) => ({ ...line, key: line.id }))}
                credits={card.credits.map((line) => ({ ...line, key: line.id }))}
                onViewPlan={() => onViewPlan(card.planId)}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}

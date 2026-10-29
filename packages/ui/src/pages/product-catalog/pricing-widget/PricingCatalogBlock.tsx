import type { PricingCard, PricingOption, PricingSelection } from '@fp/domain'
import { CheckIcon, CoinsIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { PageBody, PageHeader } from '@ui/compositions/layout/Page'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'

export const PricingCatalogBlockProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/layout/Page',
    'compositions/layout/Section',
    'compositions/forms/OptionSelect',
  ],
  note: 'The pricing widget, as V1 shows it: a billing-period and currency picker, then one Section per plan priced in them, with its fee, what it includes and the credits it grants.',
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

function PlanCard({ card, onViewPlan }: { card: PricingCard; onViewPlan: (id: string) => void }) {
  return (
    <Section title={card.name} as="h2" bodyClassName="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        {card.price ? (
          <p className="flex items-baseline gap-1">
            <span className="text-2xl font-medium tabular-nums">{card.price}</span>
            <span className="text-muted-foreground text-sm">/{card.per}</span>
          </p>
        ) : (
          <p className="text-2xl font-medium">Usage-based</p>
        )}
        {card.price && card.hasUsage ? (
          <p className="text-muted-foreground text-xs">Plus usage</p>
        ) : !card.price ? (
          <p className="text-muted-foreground text-xs">Billed on what is used</p>
        ) : null}
        {card.description ? (
          <p className="text-muted-foreground text-[13px]">{card.description}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onViewPlan(card.planId)}
      >
        View plan
      </Button>

      {card.included.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Included</p>
          <ul className="flex flex-col gap-2" aria-label={`Included in ${card.name}`}>
            {card.included.map((line) => (
              <li key={line.id} className="flex items-start gap-2 text-sm">
                <CheckIcon
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {line.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.credits.length > 0 ? (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">Credits</p>
          <ul className="flex flex-col gap-2" aria-label={`Credits in ${card.name}`}>
            {card.credits.map((line) => (
              <li key={line.id} className="flex items-start gap-2 text-sm">
                <CoinsIcon
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {line.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  )
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
        <div className="w-40">
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
        <div className="w-32">
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
      <PageHeader title="Pricing widget" {...(pickers ? { actions: pickers } : {})} />
      <PageBody>
        {loading ? (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-busy="true"
            aria-label="Loading plans"
          >
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-72 rounded-xl" />
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
              <PlanCard key={card.planId} card={card} onViewPlan={onViewPlan} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}

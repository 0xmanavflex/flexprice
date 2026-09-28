import { SUBSCRIPTION_STATUS_LABEL, SubscriptionStatus } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The subscription list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `CouponFilters`: V1's faceted builder as the registry
 * component, controlled from the query. Status today — the lifecycle a person
 * narrows by; plan and billing period join `FIELDS` when the search contract
 * earns them.
 */
export const SubscriptionFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the subscription query. Status today; the field array grows.',
})

const STATUS_OPTIONS = Object.values(SubscriptionStatus).map((value) => ({
  value,
  label: SUBSCRIPTION_STATUS_LABEL[value],
}))

const FIELDS: FilterField[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
]

const STATUSES = new Set<string>(Object.values(SubscriptionStatus))

export interface SubscriptionFiltersProps {
  statuses: SubscriptionStatus[]
  onStatusesChange: (statuses: SubscriptionStatus[]) => void
}

export function SubscriptionFilters({ statuses, onStatusesChange }: SubscriptionFiltersProps) {
  const query: FilterQuery =
    statuses.length > 0
      ? createFilterQuery([
          createFilterRule({ id: 'status', path: ['status'], operator: 'is_any_of', value: statuses }),
        ])
      : createFilterQuery()

  return (
    <FilterBar
      fields={FIELDS}
      query={query}
      onQueryChange={(_next, flat: FlatFilter[]) => {
        const rule = flat.find((f) => f.field === 'status')
        const next = (rule?.values ?? [])
          .map(String)
          .filter((s): s is SubscriptionStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}

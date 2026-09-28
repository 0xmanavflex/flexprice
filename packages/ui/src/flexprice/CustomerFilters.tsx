import { CUSTOMER_STATUS_LABEL, CustomerStatus } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The customer list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `CouponFilters`: V1's faceted builder as the registry
 * component, controlled from the query. Status today; the field array grows as
 * the search contract earns more facets.
 */
export const CustomerFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the customer query. Status today; the field array grows.',
})

const STATUS_OPTIONS = Object.values(CustomerStatus).map((value) => ({
  value,
  label: CUSTOMER_STATUS_LABEL[value],
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

const STATUSES = new Set<string>(Object.values(CustomerStatus))

export interface CustomerFiltersProps {
  statuses: CustomerStatus[]
  onStatusesChange: (statuses: CustomerStatus[]) => void
}

export function CustomerFilters({ statuses, onStatusesChange }: CustomerFiltersProps) {
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
          .filter((s): s is CustomerStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}

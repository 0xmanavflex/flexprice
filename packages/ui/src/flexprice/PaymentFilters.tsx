import { PAYMENT_STATUS_LABEL, PaymentStatus } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The payment list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `CouponFilters`: the faceted builder as the registry
 * component, controlled from the query. Status today — succeeded, failed and
 * the rest; a date range and a method join `FIELDS` when the list earns them.
 */
export const PaymentFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the payment query. Status today; the field array grows.',
})

const STATUS_OPTIONS = Object.values(PaymentStatus).map((value) => ({
  value,
  label: PAYMENT_STATUS_LABEL[value],
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

const STATUSES = new Set<string>(Object.values(PaymentStatus))

export interface PaymentFiltersProps {
  statuses: PaymentStatus[]
  onStatusesChange: (statuses: PaymentStatus[]) => void
}

export function PaymentFilters({ statuses, onStatusesChange }: PaymentFiltersProps) {
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
          .filter((s): s is PaymentStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}

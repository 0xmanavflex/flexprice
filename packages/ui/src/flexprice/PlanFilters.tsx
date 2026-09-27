import { PLAN_STATUS_LABEL, PlanStatus } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The plan list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `FeatureFilters`: V1's faceted builder as the registry
 * component, controlled from the query so the chips always reflect the URL.
 * Only **Status** is offered today — the one plan filter the search contract and
 * the read model can carry — and the `FIELDS` array is where more join.
 */
export const PlanFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the plan query. Status today; the field array grows.',
})

const STATUS_OPTIONS = Object.values(PlanStatus).map((value) => ({
  value,
  label: PLAN_STATUS_LABEL[value],
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

const STATUSES = new Set<string>(Object.values(PlanStatus))

export interface PlanFiltersProps {
  statuses: PlanStatus[]
  onStatusesChange: (statuses: PlanStatus[]) => void
}

export function PlanFilters({ statuses, onStatusesChange }: PlanFiltersProps) {
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
          .filter((s): s is PlanStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}

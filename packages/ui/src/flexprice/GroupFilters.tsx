import { GROUP_STATUS_LABEL, GroupStatus } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The group list's advanced filter, over `@reui/filters`.
 *
 * The same shape as `CouponFilters`: V1's faceted builder as the registry
 * component, controlled from the query. Status today; the kind a group holds
 * joins `FIELDS` when the search contract earns it.
 */
export const GroupFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the group query. Status today; the field array grows.',
})

const STATUS_OPTIONS = Object.values(GroupStatus).map((value) => ({
  value,
  label: GROUP_STATUS_LABEL[value],
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

const STATUSES = new Set<string>(Object.values(GroupStatus))

export interface GroupFiltersProps {
  statuses: GroupStatus[]
  onStatusesChange: (statuses: GroupStatus[]) => void
}

export function GroupFilters({ statuses, onStatusesChange }: GroupFiltersProps) {
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
          .filter((s): s is GroupStatus => STATUSES.has(s))
        onStatusesChange(next)
      }}
    />
  )
}

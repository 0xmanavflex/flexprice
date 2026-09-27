import {
  FEATURE_STATUS_LABEL,
  FEATURE_TYPE_LABEL,
  FeatureStatus,
  FeatureType,
} from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type {
  FilterField,
  FilterNode,
  FilterQuery,
} from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The feature list's advanced filter, over `@reui/filters`.
 *
 * This is V1's faceted filter builder — attribute, then operator, then value —
 * as the registry component rather than a hand-rolled `FilterPopover`. It is
 * *controlled from the query*: the tree is rebuilt from `types` and `statuses`
 * every render, so the chips always reflect the URL and there is no second copy
 * of the truth to drift.
 *
 * **Type** and **Status** are offered — the two feature filters the read model
 * and the search contract can carry. Created and Group join the `FIELDS` array
 * the moment the query grows to hold them; the point of the builder is that
 * adding a field is a row in an array, not a new control.
 */
export const FeatureFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the feature query type and status.',
})

const TYPE_OPTIONS = Object.values(FeatureType).map((value) => ({
  value,
  label: FEATURE_TYPE_LABEL[value],
}))

const STATUS_OPTIONS = Object.values(FeatureStatus).map((value) => ({
  value,
  label: FEATURE_STATUS_LABEL[value],
}))

/**
 * The fields the builder offers. `is_any_of` is the one operator whose flat
 * result maps straight onto the query, so each field pins to it rather than
 * offering operators the URL cannot round-trip.
 */
const FIELDS: FilterField[] = [
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    options: TYPE_OPTIONS,
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: STATUS_OPTIONS,
    operators: [{ value: 'is_any_of', label: 'is any of', arity: 'many' }],
    defaultOperator: 'is_any_of',
  },
]

const TYPES = new Set<string>(Object.values(FeatureType))
const STATUSES = new Set<string>(Object.values(FeatureStatus))

export interface FeatureFilterValue {
  types: FeatureType[]
  statuses: FeatureStatus[]
}

export interface FeatureFiltersProps {
  types: FeatureType[]
  statuses: FeatureStatus[]
  onChange: (value: FeatureFilterValue) => void
}

export function FeatureFilters({ types, statuses, onChange }: FeatureFiltersProps) {
  const rules: FilterNode[] = []
  if (types.length > 0) {
    rules.push(createFilterRule({ id: 'type', path: ['type'], operator: 'is_any_of', value: types }))
  }
  if (statuses.length > 0) {
    rules.push(
      createFilterRule({ id: 'status', path: ['status'], operator: 'is_any_of', value: statuses }),
    )
  }
  const query: FilterQuery = createFilterQuery(rules)

  return (
    <FilterBar
      variant="advanced"
      fields={FIELDS}
      query={query}
      onQueryChange={(_next, flat: FlatFilter[]) => {
        const nextTypes = (flat.find((f) => f.field === 'type')?.values ?? [])
          .map(String)
          .filter((t): t is FeatureType => TYPES.has(t))
        const nextStatuses = (flat.find((f) => f.field === 'status')?.values ?? [])
          .map(String)
          .filter((s): s is FeatureStatus => STATUSES.has(s))
        onChange({ types: nextTypes, statuses: nextStatuses })
      }}
    />
  )
}

import { FEATURE_TYPE_LABEL, FeatureType } from '@fp/domain'
import { FilterBar, type FlatFilter } from '@ui/compositions/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * The feature list's advanced filter, over `@reui/filters`.
 *
 * This is V1's faceted filter builder — attribute, then operator, then value —
 * as the registry component rather than a hand-rolled `FilterPopover`. It is
 * *controlled from the query*: the tree is rebuilt from `types` every render, so
 * the chips always reflect the URL and there is no second copy of the truth to
 * drift, exactly as every other list surface here works.
 *
 * Only **Type** is offered today, because it is the only feature filter the
 * `POST /features/search` contract and the read model can carry. Created,
 * Status and Group join the `FIELDS` array below the moment the query grows to
 * hold them — the point of using the builder now is that adding a field is a
 * row in an array, not a new control.
 */
export const FeatureFiltersProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters'],
  note: 'Advanced filter builder bound to the feature query. Type today; the field array grows.',
})

const TYPE_OPTIONS = Object.values(FeatureType).map((value) => ({
  value,
  label: FEATURE_TYPE_LABEL[value],
}))

/**
 * The fields the builder offers. `is_any_of` is the one operator whose flat
 * result maps straight onto `query.types`, so the field pins to it rather than
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
]

const TYPES = new Set<string>(Object.values(FeatureType))

export interface FeatureFiltersProps {
  types: FeatureType[]
  onTypesChange: (types: FeatureType[]) => void
}

export function FeatureFilters({ types, onTypesChange }: FeatureFiltersProps) {
  const query: FilterQuery =
    types.length > 0
      ? createFilterQuery([
          createFilterRule({ id: 'type', path: ['type'], operator: 'is_any_of', value: types }),
        ])
      : createFilterQuery()

  return (
    <FilterBar
      fields={FIELDS}
      query={query}
      onQueryChange={(_next, flat: FlatFilter[]) => {
        const rule = flat.find((f) => f.field === 'type')
        const next = (rule?.values ?? [])
          .map(String)
          .filter((t): t is FeatureType => TYPES.has(t))
        onTypesChange(next)
      }}
    />
  )
}

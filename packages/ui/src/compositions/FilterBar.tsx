import { FilterIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import { Filters } from '@ui/components/reui/filters/filters'
import { createFilterQuery, flattenFilterConditions } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'

/**
 * Filtering, over `@reui/filters`.
 *
 * The registry component edits a *tree* — nested AND/OR groups — and that is
 * more than our URLs can carry. Every list screen keeps its query in search
 * params so a filtered view is a link, and a nested boolean expression does
 * not survive that round trip without inventing an encoding for it.
 *
 * So this deliberately uses the `basic` chrome, which renders and edits the
 * flat case, and hands the caller `flattenFilterConditions` output: a plain
 * array of `{ field, operator, values }`. That is what a URL can hold and what
 * `POST /<entity>/search` already accepts.
 *
 * The tree is still the underlying state, so moving to nested filtering later
 * is a change of `variant` plus a URL codec — not a rewrite. Until then, a
 * shape we cannot serialise is a shape we do not offer.
 */
export const FilterBarProvenance = provenance({
  source: 'composition',
  composes: ['@reui/filters', 'ui/button'],
  note: 'Filters in `basic` chrome, flattened to what a URL and the search API can carry.',
})

export interface FlatFilter {
  field: string
  operator: string
  values: unknown[]
}

export interface FilterBarProps {
  fields: FilterField[]
  query: FilterQuery
  onQueryChange: (query: FilterQuery, flat: FlatFilter[]) => void
  size?: 'sm' | 'default'
}

/** A query with nothing in it. Exported so callers can seed state with it. */
export function emptyFilterQuery(): FilterQuery {
  return createFilterQuery()
}

export function FilterBar({ fields, query, onQueryChange, size = 'sm' }: FilterBarProps) {
  return (
    <Filters
      size={size}
      fields={fields}
      query={query}
      onQueryChange={(next: FilterQuery) => {
        /*
         * `flattenFilterConditions` skips a half-built rule, so a rule whose
         * value has not been chosen yet cannot reach the request and quietly
         * filter everything to nothing.
         */
        onQueryChange(next, flattenFilterConditions(next) as FlatFilter[])
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1.5 font-normal"
        >
          <FilterIcon aria-hidden className="size-4" />
          Filter
        </Button>
      }
    />
  )
}

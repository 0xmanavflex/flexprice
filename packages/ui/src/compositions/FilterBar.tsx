import { useState } from 'react'
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
  /**
   * Which chrome draws the query.
   *
   * `basic` is the flat pill row the registry documents as "a toolbar over a
   * table" — a chip reading `Status  is any of  Select…` with a kebab, the
   * trigger below, and Clear. That is the reference bar, and it is the default.
   *
   * `advanced` is the nested condition builder, which the registry documents as
   * being for "a sidebar or a settings page". Rendered `inline` in a toolbar it
   * draws its whole empty-state panel — a glyph, "No filters yet", and Add
   * filter / Add group — across the bar, and it honours neither `trigger` nor
   * `showClear`, both of which belong to the chip row. It is kept as an option
   * for a surface that genuinely wants a builder; it is not what a list screen
   * wants.
   */
  variant?: 'basic' | 'advanced'
  /** Where the advanced builder renders. Ignored in `basic`. */
  advancedMode?: 'popover' | 'inline'
  /** A Clear button once the query holds anything (the reference bar has one). */
  showClear?: boolean
}

/** A query with nothing in it. Exported so callers can seed state with it. */
export function emptyFilterQuery(): FilterQuery {
  return createFilterQuery()
}

/** What a query means once half-built rules are dropped. Two queries with the
 *  same signature select the same records, whatever drafts are open. */
function committedSignature(query: FilterQuery): string {
  return JSON.stringify(flattenFilterConditions(query))
}

export function FilterBar({
  fields,
  query,
  onQueryChange,
  size = 'sm',
  variant = 'basic',
  advancedMode = 'popover',
  showClear = true,
}: FilterBarProps) {
  /*
   * The bar owns the tree; the caller owns what it *means*.
   *
   * This is not a convenience — without it the bar cannot be used at all.
   * Callers derive `query` from the committed filter (`statuses` in the URL),
   * and picking an attribute creates a rule whose value has not been chosen
   * yet. `flattenFilterConditions` deliberately skips such a rule, so the
   * caller is told "nothing is filtered", recomputes the same empty query it
   * started with, and the chip the user was halfway through filling in is
   * destroyed under them. Choosing "Status" put the chip on screen and took it
   * away in the same frame, so no filter could ever be completed.
   *
   * Holding the draft here keeps the half-built rule alive locally while the
   * caller still only ever hears about rules that are finished.
   */
  const [draft, setDraft] = useState<FilterQuery>(query)
  const incoming = committedSignature(query)
  const [seen, setSeen] = useState(incoming)

  /*
   * Re-seed only when the committed meaning changes from outside — a URL, the
   * back button, a Clear elsewhere. Comparing signatures rather than trees is
   * what stops an open draft being wiped by the caller's own echo of the
   * change that draft just produced. Adjusting state during render is the
   * documented way to react to a changed prop without a wasted commit.
   */
  if (incoming !== seen) {
    setSeen(incoming)
    setDraft(query)
  }

  return (
    <Filters
      size={size}
      variant={variant}
      advancedMode={advancedMode}
      showClear={showClear}
      fields={fields}
      query={draft}
      onQueryChange={(next: FilterQuery) => {
        setDraft(next)
        /*
         * `flattenFilterConditions` skips a half-built rule, so a rule whose
         * value has not been chosen yet cannot reach the request and quietly
         * filter everything to nothing.
         */
        const flat = flattenFilterConditions(next) as FlatFilter[]
        setSeen(JSON.stringify(flat))
        onQueryChange(next, flat)
      }}
      trigger={
        // Replaces the row's own "Add filter" button, so the control reads the
        // same as Sort beside it. Only the chip row draws a trigger — the
        // inline builder ignores this, which is why it used to vanish.
        <Button variant="outline" size="sm">
          <FilterIcon aria-hidden className="size-4" />
          Filter
        </Button>
      }
    />
  )
}

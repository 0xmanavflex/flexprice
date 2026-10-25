import type { ReactNode } from 'react'
import { Input } from '@ui/components/primitives/input'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { useDebouncedSearch } from './useDebouncedSearch'

/**
 * The search-and-filter bar above a list.
 *
 * It reports what the user asked for and renders what it is given. The route owns the query, so the
 * toolbar and the grid below it cannot disagree about the current filter: they
 * are both reading the same URL. The search field keeps local state and pushes
 * to the route after a 250ms pause (Enter or blur pushes at once); an outside
 * change to `search`, such as Clear filters, replaces what is typed.
 *
 * `role="search"` makes it a landmark, so it is reachable directly rather than
 * by tabbing through the page.
 */
export const ToolbarProvenance = provenance({
  source: 'composition',
  composes: ['ui/input', 'ui/button'],
  note: 'Controlled search + filter region for list surfaces.',
})

export interface ToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  /** Filter controls: selects, chips, whatever the surface needs. */
  filters?: ReactNode
  /** Rendered when anything is narrowing the list. */
  activeFilterCount?: number
  onClear?: () => void
  /** Actions aligned to the end, e.g. "New feature". */
  actions?: ReactNode
}

export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  searchLabel = 'Search',
  filters,
  activeFilterCount = 0,
  onClear,
  actions,
}: ToolbarProps) {
  const { draft, update, commit } = useDebouncedSearch(search, onSearchChange)
  return (
    <div role="search" className="flex flex-wrap items-center justify-between gap-3">
      <Input
        type="search"
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        value={draft}
        onChange={(event) => update(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        className="h-9 w-72 max-w-full"
      />

      {filters}

      {activeFilterCount > 0 && onClear ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear filters
          {/* The count is in the label, not only in a badge, so it is spoken. */}
          <span className="sr-only">: {activeFilterCount} active</span>
          <span aria-hidden className="text-muted-foreground ml-1">
            ({activeFilterCount})
          </span>
        </Button>
      ) : null}

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

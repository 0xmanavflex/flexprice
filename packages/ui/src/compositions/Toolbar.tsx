import type { ReactNode } from 'react'
import { Input } from '@ui/components/primitives/input'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'

/**
 * The search-and-filter bar above a list.
 *
 * Controlled, like every list surface in this package: it reports what the user
 * asked for and renders what it is given. The route owns the query, so the
 * toolbar and the grid below it cannot disagree about the current filter — they
 * are both reading the same URL.
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
  /** Filter controls — selects, chips, whatever the surface needs. */
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
  return (
    <div role="search" className="flex flex-wrap items-center justify-between gap-3">
      <Input
        type="search"
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="h-9 w-72 max-w-full"
      />

      {filters}

      {activeFilterCount > 0 && onClear ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear filters
          {/* The count is in the label, not only in a badge, so it is spoken. */}
          <span className="sr-only"> — {activeFilterCount} active</span>
          <span aria-hidden className="text-muted-foreground ml-1">
            ({activeFilterCount})
          </span>
        </Button>
      ) : null}

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

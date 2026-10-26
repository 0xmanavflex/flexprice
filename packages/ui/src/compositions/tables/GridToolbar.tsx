import type { ReactNode } from 'react'
import { SearchIcon, XIcon } from '@ui/icons'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import { useListOffer } from '../feedback/EmptyState'
import { provenance } from '@ui/provenance'
import { useDebouncedSearch } from './useDebouncedSearch'

/**
 * The bar above a grid: a compact table heading and search on the left, controls
 * on the right, and the primary create action pinned to the very end.
 *
 * The `heading` is the entity's name as a small label: not the old page hero.
 * The breadcrumb in the shell already names the screen, so the list surface only
 * needs a quiet title over the table, the way ReUI's `data-grid-base` header
 * sets a heading beside its toolbar.
 *
 * The search carries the input group's own light border: the `input`/`border`
 * tokens: so it reads as a field you type into rather than a bare line of text.
 * It grows to take the row, which pins the controls and the create button to the
 * end.
 *
 * The clear button only exists once there is something to clear, because a
 * permanent ✕ on an empty field is a control that does nothing most of the
 * time: and it is the one thing people misread as "close this".
 *
 * The create CTA comes LAST, after Filter and Sort: the review puts the primary
 * action at the end of the toolbar rather than in a page header.
 *
 * The route owns the query, so the toolbar and the grid cannot disagree about
 * what is being shown. The field itself keeps local state and pushes to the route
 * after a 250ms pause (Enter or blur pushes at once), so typing never lags and
 * does not write a history entry per keystroke; an outside change to `search`
 * (Clear filters, back/forward) replaces what is typed.
 */
export const GridToolbarProvenance = provenance({
  source: 'composition',
  composes: ['ui/input-group'],
  note: 'Heading + bordered search left, filter/sort then the create CTA right. The bar above a data grid.',
})

export interface GridToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  placeholder?: string
  label?: string
  /**
   * A short entity title at the start of the toolbar row: names the table
   * without the page hero the breadcrumb already carries.
   */
  heading?: string
  /** Filter, Sort, and anything else. Aligned to the end, before the CTA. */
  children?: ReactNode
  /**
   * The primary create action, pinned to the very end after filter and sort.
   *
   * Optional because a list page can state it once on `ListState` instead, and
   * the toolbar picks it up from there: the empty table body needs the same
   * node, and declaring it twice is how the two drift apart.
   */
  action?: ReactNode
}

export function GridToolbar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  label = 'Search',
  heading,
  children,
  action,
}: GridToolbarProps) {
  /*
   * A list states its create action once, on `ListState`. The toolbar is
   * where it belongs on a list that has rows: the empty body only exists
   * before the first one: so it is picked up here rather than threaded
   * through every grid. A grid that passes its own `action` keeps it.
   */
  const offer = useListOffer()
  const createAction = action ?? offer?.action
  const { draft, update, commit, clear } = useDebouncedSearch(search, onSearchChange)

  return (
    /*
     * One row while it fits, two when it does not.
     *
     * Search is the only thing here that can give up width, so on one row it
     * absorbs every shortfall: it measured 53px at 390px wide, which is the
     * magnifier and four letters of "Search". A floor stops that, and wrapping
     * gives the row somewhere to put the overflow: the search takes the first
     * line and the controls drop under it, right-aligned, rather than the
     * field being squeezed to nothing.
     */
    <div role="search" className="flex flex-wrap items-center justify-between gap-3">
      {/*
        The page's one `<h1>`: the entity's name: but styled as a compact
        label rather than a hero, because the breadcrumb already carries the
        page title and the visual hierarchy is the layout, not a big heading.
      */}
      {/* The page title lives in the breadcrumb, so no visible heading sits over
          the table. It stays as an `sr-only` <h1> only so the page keeps its one
          heading for assistive tech and the journey tests. */}
      {heading ? <h1 className="sr-only">{heading}</h1> : null}
      {/* Constrained, not full-width: a search that stretches the whole bar
          reads as one big empty field. Capped at a comfortable width, with the
          controls pinned to the right by `ml-auto`. */}
      <InputGroup className="h-9 w-72 max-w-full">
        <InputGroupAddon align="inline-start">
          <SearchIcon aria-hidden className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => update(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
          }}
        />
        {draft.length > 0 ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label="Clear search"
              onClick={clear}
            >
              <XIcon aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {children || createAction ? (
        <div className="flex items-center gap-2">
          {children ? <div className="flex items-center gap-2">{children}</div> : null}
          {createAction}
        </div>
      ) : null}
    </div>
  )
}

import type { ReactNode } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/primitives/input-group'
import { provenance } from '@ui/provenance'

/**
 * The bar above a grid: a compact table heading and search on the left, controls
 * on the right, and the primary create action pinned to the very end.
 *
 * The `heading` is the entity's name as a small label — not the old page hero.
 * The breadcrumb in the shell already names the screen, so the list surface only
 * needs a quiet title over the table, the way ReUI's `data-grid-base` header
 * sets a heading beside its toolbar.
 *
 * The search carries the input group's own light border — the `input`/`border`
 * tokens — so it reads as a field you type into rather than a bare line of text.
 * It grows to take the row, which pins the controls and the create button to the
 * end.
 *
 * The clear button only exists once there is something to clear, because a
 * permanent ✕ on an empty field is a control that does nothing most of the
 * time — and it is the one thing people misread as "close this".
 *
 * The create CTA comes LAST, after Filter and Sort: the review puts the primary
 * action at the end of the toolbar rather than in a page header.
 *
 * Controlled, like every list surface here: the route owns the query, so the
 * toolbar and the grid cannot disagree about what is being shown.
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
   * A short entity title at the start of the toolbar row — names the table
   * without the page hero the breadcrumb already carries.
   */
  heading?: string
  /** Filter, Sort, and anything else. Aligned to the end, before the CTA. */
  children?: ReactNode
  /** The primary create action, pinned to the very end after filter and sort. */
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
  return (
    <div role="search" className="flex items-center gap-2">
      {/*
        The page's one `<h1>` — the entity's name — but styled as a compact
        label rather than a hero, because the breadcrumb already carries the
        page title and the visual hierarchy is the layout, not a big heading.
      */}
      {heading ? (
        <h1 className="mr-1 shrink-0 truncate text-sm font-semibold text-foreground">{heading}</h1>
      ) : null}
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {search.length > 0 ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
            >
              <XIcon aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

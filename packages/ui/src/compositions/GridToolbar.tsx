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
 * The bar above a grid: search on the left, controls on the right.
 *
 * The search carries the input group's own light border — the `input`/`border`
 * tokens — so it reads as a field you type into rather than a bare line of
 * text. It still takes the width it is given, with the controls pinned to the
 * end of the row.
 *
 * The clear button only exists once there is something to clear, because a
 * permanent ✕ on an empty field is a control that does nothing most of the
 * time — and it is the one thing people misread as "close this".
 *
 * Controlled, like every list surface here: the route owns the query, so the
 * toolbar and the grid cannot disagree about what is being shown.
 */
export const GridToolbarProvenance = provenance({
  source: 'composition',
  composes: ['ui/input-group'],
  note: 'Bordered search left, controls right. The bar above a data grid.',
})

export interface GridToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  placeholder?: string
  label?: string
  /** Filter, Sort, and anything else. Aligned to the end. */
  children?: ReactNode
}

export function GridToolbar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  label = 'Search',
  children,
}: GridToolbarProps) {
  return (
    <div role="search" className="flex items-center gap-2">
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

      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}

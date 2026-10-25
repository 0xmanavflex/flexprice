import type { ReactNode } from 'react'
import { DataGridPagination } from '@ui/components/reui/data-grid/data-grid-pagination'
import { provenance } from '@ui/provenance'
import { FitToWindow } from '../layout/FitToWindow'

/**
 * The bar below a grid: how many rows, and which page.
 *
 * `DataGridPagination` already reads the table instance for the rows-per-page
 * select, the "1 – 22 of 64" range and the numbered pages, so none of that is
 * restated here: restating it is how a footer starts disagreeing with the
 * table above it. This adds the one control the registry does not ship, and
 * puts it on the opposite end.
 *
 * `sizes` includes the measured capacity when fitting, so the select can show
 * the number actually in use rather than snapping to the nearest preset and
 * implying a page size nobody chose.
 */
export const GridFooterProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid'],
  note: 'Fit-to-window beside DataGridPagination, which owns rows-per-page and paging.',
})

export interface GridFooterProps {
  fitToWindow: boolean
  onFitToWindowChange: (fit: boolean) => void
  /** The page size currently in use, so the select can offer it. */
  pageSize: number
  /** What the records are, for "1 - 22 of 64 features". */
  noun?: string
  children?: ReactNode
}

const PRESETS = [10, 25, 50, 100]

export function GridFooter({
  fitToWindow,
  onFitToWindowChange,
  pageSize,
  noun,
  children,
}: GridFooterProps) {
  const sizes = [...new Set([...PRESETS, pageSize])].sort((a, b) => a - b)

  return (
    <div className="flex items-center gap-2">
      <FitToWindow pressed={fitToWindow} onPressedChange={onFitToWindowChange} />
      {children}
      <DataGridPagination
        className="w-full"
        sizes={sizes}
        {...(noun ? { info: `{from} - {to} of {count} ${noun}` } : {})}
      />
    </div>
  )
}

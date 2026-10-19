import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { type ColumnDef, type PaginationState, useTable } from '@tanstack/react-table'
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  FilterIcon,
  MoreHorizontalIcon,
  SearchIcon,
  XIcon,
} from '@ui/icons'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
} from '@ui/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@ui/components/reui/data-grid/data-grid-pagination'
import { DataGridTable } from '@ui/components/reui/data-grid/data-grid-table'
import type { FilterField, FilterQuery } from '@ui/components/reui/filters/filters-types'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/primitives/select'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { DataRegion } from '@ui/compositions/feedback/DataBoundary'
import { EmptyState } from '@ui/compositions/feedback/EmptyState'
import { ErrorState, type ErrorKind } from '@ui/compositions/feedback/States'
import { GuidedEmptyState } from '@ui/compositions/feedback/GuidedEmptyState'
import type { EmptyScene } from '@ui/compositions/feedback/SceneIllustration'
import { FilterBar, type FlatFilter } from '@ui/compositions/tables/FilterBar'
import { SortMenu, type SortOption } from '@ui/compositions/tables/SortMenu'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import type { EntityColumn } from './cells'

/**
 * The one list table.
 *
 * Twenty list screens, one component. Before this there were twelve grids,
 * each a hand-assembled `DataGrid` with its own `tableLayout`, its own toolbar
 * order, its own idea of a row's height and its own empty state — which is why
 * no two of them lined up, and why fixing the padding meant fixing it twelve
 * times and missing two.
 *
 * So the layout is *not* a prop. A caller supplies rows, columns and the
 * handlers for what it wants told about; the header band, the row height, the
 * cell padding, the pinning rule, the toolbar order and the footer are decided
 * here, once. The generic escape hatches that would let a page differ — a
 * `tableLayout` passthrough, a `tableClassNames`, a raw `ColumnDef` — are
 * deliberately absent, because every one of them is a way for the twenty to
 * drift apart again.
 *
 * The shape of it:
 *
 *   **Borderless by default.** No card, no outer box. The table runs the full
 *   width of the page content, and the page's own margins are the only frame it
 *   needs. A box around a table that already has a header band and row rules is
 *   three nested rectangles saying the same thing. `border` is the one switch:
 *   it draws a rounded outline around the rows (not the toolbar) for a table
 *   that sits among other panels with no `Section` of its own around it. It is
 *   the same table either way — list pages, detail tables and settings tables
 *   all render through here.
 *
 *   **The page scrolls, not the table.** Sticky headers are off. A table with
 *   its own vertical scrollbar inside a page that also scrolls gives you two
 *   scrollbars and a body that is shorter than the screen; at twenty-five rows
 *   the page scroll is the honest one. Horizontal is different — a wide table
 *   scrolls sideways *within* the page, which is why the scroll area is here
 *   at all.
 *
 *   **Columns fill the page.** A `ResizeObserver` scales every non-fixed
 *   column so the set exactly spans the content width, rather than leaving the
 *   dead band on the right that a fixed-width table always leaves on a wide
 *   screen. When the page is too narrow the same scale runs backwards, down to
 *   {@link MIN_SCALE} — six per cent — after which the table gives up and
 *   scrolls instead of squeezing a date column into nothing.
 *
 *   **Pinning is a consequence, not a setting.** The checkbox and `⋯` columns
 *   pin — and grow their divider — exactly when the table actually overflows.
 *   Pinned columns on a table that fits are a divider and a shadow drawn
 *   around nothing.
 */
export const EntityListProvenance = provenance({
  source: 'composition',
  composes: ['@reui/data-grid', '@reui/filters', 'ui/select', 'compositions/feedback/States'],
  note: 'The one list table: borderless (or bordered via `border`), 44px header, 60px rows, auto-width columns, pin-on-overflow. Lineage: @reui/empty-state-3.',
})

/* ------------------------------------------------------------------ *
 * Layout constants — the numbers the design fixes
 * ------------------------------------------------------------------ */

/** The `⋯` row-actions column. Wide enough for a 28px button and no wider. */
const ACTIONS_WIDTH = 40
/**
 * How far the set of columns may be squeezed below its natural width before
 * the table stops squeezing and scrolls sideways instead.
 *
 * Six per cent is roughly the slack in a comfortable column — the difference
 * between "Updated" with room to breathe and "Updated" against its own edge —
 * and nothing past it buys legibility, it only takes it.
 */
const MIN_SCALE = 0.94
/** No flexible column shrinks below this, whatever the scale says. */
const MIN_FLEX_WIDTH = 64
/** The page sizes the footer offers. */
const PAGE_SIZES = [10, 25, 50, 100]
/** Ids reserved by the table itself, so a caller cannot collide with them. */
const ACTIONS_ID = '__actions'

/* ------------------------------------------------------------------ *
 * Props
 * ------------------------------------------------------------------ */

/** What v9 no longer exports: column id to whether it is shown. */
type ColumnVisibility = Record<string, boolean>

/** The filter button and the ReUI Filters chip row behind it. */
export interface EntityFilter {
  fields: FilterField[]
  query: FilterQuery
  onQueryChange: (query: FilterQuery, flat: FlatFilter[]) => void
  /** Drives the badge on the icon button. Omit for no badge. */
  activeCount?: number | undefined
  /** A "Status: All" select beside the search, writing the same rule as the filter. */
  quick?: EntityQuickSelect | undefined
  /** AND-only conditions, no groups: what the search endpoints can run. */
  flat?: boolean | undefined
}

/** The inline select next to the search box: one value, `all` for none. */
export interface EntityQuickSelect {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}

/** The sort button and the menu behind it. */
export interface EntitySort<F extends string = string> {
  options: SortOption<F>[]
  field: F
  direction: 'asc' | 'desc'
  onChange: (field: F, direction: 'asc' | 'desc') => void
  /**
   * Badges the sort button. Pass 1 when the sort differs from the list's
   * default, so a non-obvious ordering is visible without opening the menu.
   */
  activeCount?: number | undefined
}

/** One item in a row's `⋯` menu. */
export interface EntityRowAction {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** Renders in the destructive colour, under a separator. */
  destructive?: boolean | undefined
  disabled?: boolean | undefined
}

/** One of the three cards under the first-run empty state. */
export interface EntityGuide {
  title: string
  description?: string | undefined
  href: string
  icon?: ReactNode
}

/** What a list says when nothing has been created yet. */
export interface EntityEmpty {
  title: string
  description?: string | undefined
  /** Up to two 32px buttons — create, and a way to learn more. */
  actions?: ReactNode
  /** Three cards. Each ends in "Read docs". */
  guides?: EntityGuide[] | undefined
  /** The drawing for this area of the product. Defaults to the table figure. */
  scene?: EmptyScene | undefined
}

export interface EntityListProps<T> {
  /* --- the data --- */
  rows: T[]
  /** Across every page, from the server. Drives "1 – 25 of 64". */
  total: number
  columns: EntityColumn<T>[]
  getRowId: (row: T) => string
  /** Names the table for assistive tech, e.g. "Features". */
  label: string
  /** For "1 – 25 of 64 features". Defaults to "records". */
  noun?: string | undefined

  /* --- paging --- */
  /** 1-based, as every domain query here counts pages. */
  page: number
  pageSize: number
  /** Both together: a page-size change is also a page change, and reporting
   *  them separately makes the caller reconcile two events into one request. */
  onPaginationChange: (page: number, pageSize: number) => void

  /* --- the toolbar --- */
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string | undefined
  filter?: EntityFilter | undefined
  sort?: EntitySort | undefined
  /** The create button on the right of the toolbar, beside the filter. */
  primaryAction?: ReactNode
  /** Enables Export CSV in the `⋯` menu, writing to this file name. */
  exportFileName?: string | undefined

  /* --- rows --- */
  onRowClick?: ((row: T) => void) | undefined
  rowActions?: ((row: T) => EntityRowAction[]) | undefined

  /* --- states --- */
  isLoading?: boolean | undefined
  error?: string | null | undefined
  /** Why `error` happened; picks the figure and withholds retry for `denied`. */
  errorKind?: ErrorKind | undefined
  onRetry?: (() => void) | undefined
  /**
   * The rows were narrowed in the browser from the page fetched, so zero rows
   * on a later page means "none here", not "this page is past the end".
   */
  isPageLocalFilter?: boolean | undefined
  /** A retry is in flight. Disables the retry button. */
  isRetrying?: boolean | undefined
  /** A background request is updating the rows on screen: they stay, a thin bar says so. */
  isRefreshing?: boolean | undefined
  /** The rows on screen belong to the previous page or filter; they are dimmed. */
  isProvisional?: boolean | undefined
  /** True when a search or filter is what emptied the list, not the catalogue
   *  being empty. Only the page can tell these apart. */
  isFiltered?: boolean | undefined
  onClearFilters?: (() => void) | undefined
  /** Shown when the list is empty and no filter is responsible. */
  empty?: EntityEmpty | undefined
  /** Copy for the filtered miss. Sensible defaults if omitted. */
  filteredEmptyTitle?: string | undefined
  filteredEmptyDescription?: string | undefined

  /** The sr-only heading's tag. A list page is the page (`h1`); a table inside a detail page is not. */
  headingAs?: 'h1' | 'h3'
  /** For a table inside a panel: 36px header, 48px rows, 32px toolbar controls, and a footer only once there is a second page. */
  compact?: boolean | undefined
  /** For a short, fully shown set (an invoice's lines): no page-size picker or range footer. */
  hideFooter?: boolean | undefined
  /** Leaves out the search and filter row: a short list that needs none. */
  hideToolbar?: boolean | undefined
  /**
   * Draws a rounded outline around the rows and footer. Off (the list-page
   * look) by default; on for a table that has no surrounding `Section`.
   */
  border?: boolean | undefined
  className?: string
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

/**
 * A column heading: uppercase, 11px, wide-tracked, muted.
 *
 * Small caps rather than a heavier weight, because weight in a table is worth
 * more spent on the data. Tracking is what keeps 11px uppercase from setting
 * as a single grey smudge.
 */
function HeaderLabel({ title, className }: { title: string; className?: string }) {
  return (
    <span
      /*
       * `flex` only when centring.
       * Adding it unconditionally changed the box of every table header in
       * the app — fourteen visual baselines moved for a change that was
       * meant to touch four count columns.
       */
      className={cn(
        'text-muted-foreground text-[11px] font-medium tracking-wider uppercase',
        className && `flex ${className}`,
      )}
    >
      {title}
    </span>
  )
}

/**
 * A sortable heading.
 *
 * The arrow appears only once the column is sorted. A permanent up-down
 * chevron on every sortable column — the registry's own default — puts nine
 * identical glyphs across the header, and the one that means "this is the
 * sort" is then indistinguishable from the eight that mean "this could be".
 */
function SortableHeader({
  title,
  direction,
  onToggle,
}: {
  title: string
  direction: 'asc' | 'desc' | null
  onToggle: () => void
}) {
  const next = direction === 'asc' ? 'descending' : 'ascending'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        direction
          ? `${title}, sorted ${direction === 'asc' ? 'ascending' : 'descending'}. Sort ${next}`
          : `Sort by ${title}`
      }
      className="hover:[&>span]:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <HeaderLabel title={title} />
      {direction === 'asc' ? (
        <ArrowUpIcon aria-hidden className="text-foreground size-3 shrink-0" />
      ) : direction === 'desc' ? (
        <ArrowDownIcon aria-hidden className="text-foreground size-3 shrink-0" />
      ) : null}
    </button>
  )
}

/** The count on the filter and sort buttons. */
function CountBadge({ count }: { count: number }) {
  return (
    <span className="bg-primary text-primary-foreground pointer-events-none absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium tabular-nums">
      {count}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/** RFC 4180: quote everything, double an embedded quote. Cheaper than
 *  deciding per value whether this one happens to need it. */
function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function toCsv<T>(columns: EntityColumn<T>[], rows: T[]): string {
  const header = columns.map((column) => csvCell(column.header)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => csvCell(column.text?.(row) ?? '')).join(','),
  )
  return [header, ...body].join('\r\n')
}

function downloadCsv(filename: string, csv: string): void {
  /* Feature-detected rather than assumed: a non-browser render (a snapshot,
   * a server pass) has no object URLs, and a list that throws on an export
   * click is worse than one whose export is quietly unavailable there. */
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return
  // The BOM is what makes Excel read UTF-8 rather than the local code page,
  // which is the difference between "Café" and "CafÃ©" in the one program
  // most of these files are opened in.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Horizontal scroll
 *
 * The native bar hides until you scroll, so a table that runs past the card
 * looks clipped. This draws a bar whenever the rows are wider than the card,
 * and dragging it moves the same scroller.
 * ------------------------------------------------------------------ */

function TableScroller({
  minWidth,
  scrolls,
  children,
}: {
  minWidth: number
  /** The columns are wider than the card, so the bar is shown. */
  scrolls: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startScroll: number } | null>(null)
  const [bar, setBar] = useState({ overflow: false, thumb: 0, offset: 0, track: 0 })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const overflow = max > 1
    const track = Math.max(0, el.clientWidth - 24)
    const thumb = overflow ? Math.max(32, (el.clientWidth / el.scrollWidth) * track) : 0
    const offset = overflow && track > thumb ? (el.scrollLeft / max) * (track - thumb) : 0
    setBar((prev) =>
      prev.overflow === overflow &&
      prev.track === track &&
      Math.abs(prev.thumb - thumb) < 0.5 &&
      Math.abs(prev.offset - offset) < 0.5
        ? prev
        : { overflow, thumb, offset, track },
    )
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    return () => el.removeEventListener('scroll', measure)
  }, [measure])

  useLayoutEffect(() => {
    measure()
  }, [measure, minWidth, scrolls])

  const onThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: el.scrollLeft }
  }

  const onThumbPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    const current = drag.current
    if (!el || !current || current.pointerId !== event.pointerId) return
    const max = el.scrollWidth - el.clientWidth
    const travel = bar.track - bar.thumb
    if (travel <= 0) return
    el.scrollLeft = current.startScroll + ((event.clientX - current.startX) / travel) * max
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  return (
    <>
      <div
        ref={ref}
        className="w-full min-w-0 [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ '--table-min': `${minWidth}px` } as React.CSSProperties}
      >
        {children}
      </div>
      {scrolls ? (
        <div className="pt-1.5" aria-hidden="true">
          <div className="bg-muted relative mx-3 h-1.5 rounded-full">
            <div
              className="bg-muted-foreground/50 absolute inset-y-0 cursor-grab rounded-full active:cursor-grabbing"
              style={{ width: bar.thumb, transform: `translateX(${bar.offset}px)` }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function EntityList<T extends object>({
  rows,
  total,
  columns,
  getRowId,
  label,
  noun = 'records',
  page,
  pageSize,
  onPaginationChange,
  search,
  onSearchChange,
  searchPlaceholder,
  filter,
  sort,
  primaryAction,
  exportFileName,
  onRowClick,
  rowActions,
  isLoading = false,
  error = null,
  errorKind,
  onRetry,
  isRetrying,
  isPageLocalFilter = false,
  isRefreshing = false,
  isProvisional = false,
  isFiltered = false,
  onClearFilters,
  empty,
  filteredEmptyTitle,
  filteredEmptyDescription,
  headingAs: Heading = 'h1',
  compact = false,
  hideFooter = false,
  hideToolbar = false,
  border = false,
  className,
}: EntityListProps<T>) {
  /* --- column visibility, owned here so the ⋯ menu has something to toggle --- */
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(() =>
    Object.fromEntries(
      columns.filter((column) => column.hiddenByDefault).map((column) => [column.id, false]),
    ),
  )

  /* --- the measured width of the content area the table has to fill --- */
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState<number | null>(null)

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    /*
     * The *frame* is measured, never the table.
     *
     * The frame's width is decided by the page; the table's is decided by the
     * column sizes this observer then sets. Measuring the table would close
     * that loop — wider columns, wider table, wider measurement, wider columns
     * — and a ResizeObserver that feeds itself is the classic way to get the
     * browser's "loop completed with undelivered notifications" warning and a
     * table that grows a pixel per frame.
     */
    const observer = new ResizeObserver(() => {
      const next = node.clientWidth
      setFrameWidth((previous) =>
        previous !== null && Math.abs(previous - next) < 1 ? previous : next,
      )
    })
    observer.observe(node)
    setFrameWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [])

  /* --- what is actually on screen, in order --- */
  const visibleColumns = useMemo(
    () => columns.filter((column) => columnVisibility[column.id] !== false),
    [columns, columnVisibility],
  )

  /**
   * The column widths, and whether the result overflows.
   *
   * One pass: the fixed columns keep their widths, whatever is left is shared
   * between the rest in proportion to the widths they asked for, and the scale
   * is floored at `MIN_SCALE`. Hitting the floor is precisely the case where
   * the table must scroll, which is also what turns pinning on — one number
   * decides both, so the divider cannot appear on a table that fits.
   */
  const { sizing, overflows } = useMemo(() => {
    const fixedWidth =
      (rowActions ? ACTIONS_WIDTH : 0) +
      visibleColumns.filter((column) => column.fixed).reduce((sum, c) => sum + (c.width ?? 120), 0)
    const flexible = visibleColumns.filter((column) => !column.fixed)
    const base = flexible.reduce((sum, column) => sum + (column.width ?? 160), 0)

    const result: Record<string, number> = {}
    for (const column of visibleColumns) {
      if (column.fixed) result[column.id] = column.width ?? 120
    }
    if (rowActions) result[ACTIONS_ID] = ACTIONS_WIDTH

    if (frameWidth === null || base === 0) {
      for (const column of flexible) result[column.id] = column.width ?? 160
      return { sizing: result, overflows: false }
    }

    /*
     * A pixel held back.
     *
     * `clientWidth` is a rounded integer and the frame's real width is
     * routinely fractional, so a set of columns summing to exactly
     * `clientWidth` can still land a fraction over the true box — which the
     * scroll area answers with a scrollbar for one pixel of content. Giving
     * the pixel up is invisible; the spurious scrollbar is not.
     */
    const available = frameWidth - fixedWidth - 1
    const scale = Math.max(available / base, MIN_SCALE)

    let used = 0
    for (const column of flexible) {
      const width = Math.max(MIN_FLEX_WIDTH, Math.round((column.width ?? 160) * scale))
      result[column.id] = width
      used += width
    }

    /*
     * Rounding leaves a few pixels over. When there is room to spare they go
     * to the widest flexible column — usually the name — so the set spans the
     * frame *exactly*. A one-pixel shortfall is a one-pixel pale stripe down
     * the right edge of the header band, and it is surprisingly visible.
     */
    if (available >= base && flexible.length > 0) {
      const widest = flexible.reduce((a, b) => ((a.width ?? 160) >= (b.width ?? 160) ? a : b))
      const remainder = available - used
      result[widest.id] = Math.max(MIN_FLEX_WIDTH, (result[widest.id] ?? 0) + remainder)
      used += remainder
    }

    // A pixel of tolerance: sub-pixel frame widths are routine, and rounding
    // one of them up must not be read as "this table scrolls".
    return { sizing: result, overflows: fixedWidth + used > frameWidth + 1 }
  }, [visibleColumns, frameWidth, rowActions])
  const tableMin = Object.values(sizing).reduce((sum, width) => sum + width, 0)

  /* --- build the TanStack columns --- */
  const sortField = sort?.field
  const sortDirection = sort?.direction
  const onSortChange = sort?.onChange

  const tableColumns = useMemo(() => {
    const defs: ColumnDef<never, T>[] = []

    for (const column of columns) {
      defs.push({
        id: column.id,
        size: sizing[column.id] ?? column.width ?? 160,
        enableSorting: false,
        enableHiding: column.hideable !== false,
        meta: {
          headerTitle: column.header,
          skeleton: column.skeleton ?? <Skeleton className="h-4 w-24" />,
          ...(column.cellClassName || column.align === 'center' || column.align === 'end'
            ? {
                cellClassName: cn(
                  column.align === 'center' && 'text-center [&>*]:mx-auto',
                  column.align === 'end' && 'text-right [&>*]:ml-auto',
                  column.cellClassName,
                ),
              }
            : {}),
        },
        header: () =>
          column.sortable && onSortChange ? (
            <SortableHeader
              title={column.header}
              direction={
                sortField === (column.sortValue ?? column.id) ? (sortDirection ?? 'asc') : null
              }
              onToggle={() => {
                const value = column.sortValue ?? column.id
                const isCurrent = sortField === value
                onSortChange(value, isCurrent && sortDirection === 'asc' ? 'desc' : 'asc')
              }}
            />
          ) : column.header ? (
            <HeaderLabel
              title={column.header}
              {...(column.align === 'center'
                ? { className: 'justify-center' }
                : column.align === 'end'
                  ? { className: 'justify-end' }
                  : {})}
            />
          ) : (
            <span className="sr-only">Actions</span>
          ),
        cell: ({ row }: { row: { original: T } }) => column.cell(row.original),
      } as never)
    }

    if (rowActions) {
      defs.push({
        id: ACTIONS_ID,
        size: ACTIONS_WIDTH,
        enableSorting: false,
        enableHiding: false,
        meta: { headerTitle: 'Actions', skeleton: <Skeleton className="size-6 rounded-md" /> },
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }: { row: { original: T } }) => (
          <RowActionsMenu actions={rowActions(row.original)} />
        ),
      } as never)
    }

    return defs as never
  }, [columns, rowActions, sizing, sortField, sortDirection, onSortChange])

  const pagination: PaginationState = { pageIndex: page - 1, pageSize }

  /*
   * Pinning is derived, not stored.
   *
   * There is no `columnPinning` state to get out of step with the measurement,
   * because the measurement *is* the state: a table that fits pins nothing, a
   * table that overflows pins its two utility columns. The registry draws the
   * divider off `data-last-col`, so it arrives and leaves with the pinning.
   */
  const columnPinning = useMemo(
    () =>
      overflows
        ? {
            // `start`/`end`, not `left`/`right`: v9 renamed the axis to the
            // logical one, and a `{ left, right }` object type-checks against
            // the loose state slot and then reads as *no pinning at all* — the
            // table asks for `start.length` and gets `undefined`.
            start: [],
            end: [
              ...visibleColumns.filter((column) => column.fixed).map((column) => column.id),
              ...(rowActions ? [ACTIONS_ID] : []),
            ],
          }
        : { start: [], end: [] },
    [overflows, rowActions, visibleColumns],
  )

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns: tableColumns,
    manualPagination: true,
    // Sorting is the server's: the page holds twenty-five of sixty-four rows,
    // and sorting those twenty-five reorders a slice rather than the list.
    manualSorting: true,
    rowCount: total,
    getRowId: (row: T) => getRowId(row),
    enableRowSelection: false,
    state: { pagination, columnVisibility, columnSizing: sizing, columnPinning },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater: unknown) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: PaginationState) => PaginationState)(pagination)
          : (updater as PaginationState)
      onPaginationChange(next.pageIndex + 1, next.pageSize)
    },
  } as never)

  const handleExport = useCallback(() => {
    if (!exportFileName) return
    downloadCsv(exportFileName, toCsv(visibleColumns, rows))
  }, [exportFileName, visibleColumns, rows])

  const hideableColumns = columns.filter((column) => column.hideable !== false)

  /* --- error replaces everything: a toolbar over a table that failed to load
         offers controls that cannot do anything --- */
  if (error) {
    return (
      <ErrorState
        title={error}
        {...(errorKind ? { kind: errorKind } : {})}
        {...(onRetry ? { onRetry } : {})}
        {...(isRetrying !== undefined ? { isRetrying } : {})}
      />
    )
  }

  /*
   * "Nothing exists" is a fact about the *total*, not about this page's rows.
   * Keyed off `rows.length`, page 3 of a 60-record list that came back empty
   * (a deleted tail, a stale URL) read as "create your first record". Out of
   * range is its own state: the records are there, this page is past them.
   */
  const isOutOfRange =
    !isLoading && rows.length === 0 && total > 0 && page > 1 && !isPageLocalFilter
  const showFirstRun =
    !isLoading && rows.length === 0 && total === 0 && !isFiltered && empty !== undefined
  const goToFirstPage = () => onPaginationChange(1, pageSize)

  const toolbar = (
    <div
      role="search"
      aria-label={`Search and filter ${noun}`}
      className={cn('flex flex-wrap items-center justify-between gap-3', compact && 'px-6 py-3')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className={cn(compact ? 'h-8 w-60' : 'h-9 w-72', 'max-w-full')}>
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground size-4" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={`Search ${noun}`}
            placeholder={searchPlaceholder ?? `Search ${noun}…`}
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
                <XIcon className="size-4" aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {filter?.quick ? (
          <Select
            items={filter.quick.options as { value: string; label: string }[]}
            value={filter.quick.value}
            onValueChange={(next) => filter.quick?.onChange(String(next ?? 'all'))}
          >
            <SelectTrigger
              aria-label={filter.quick.label}
              className={cn('w-48 justify-start gap-2 pl-3', compact ? 'h-8' : 'h-9')}
            >
              <span className="text-muted-foreground">{filter.quick.label}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {filter.quick.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {filter ? (
          <FilterBar
            variant="advanced"
            advancedAlign="end"
            fields={filter.fields}
            query={filter.query}
            onQueryChange={filter.onQueryChange}
            {...(filter.flat ? { flat: true } : {})}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={filter.activeCount ? `Filter. ${filter.activeCount} active` : 'Filter'}
                className={cn('relative', compact ? 'size-8' : 'size-9')}
              >
                <FilterIcon aria-hidden />
                {filter.activeCount ? <CountBadge count={filter.activeCount} /> : null}
              </Button>
            }
          />
        ) : null}

        {sort ? (
          <SortMenu
            align="end"
            options={sort.options}
            field={sort.field}
            direction={sort.direction}
            onChange={sort.onChange}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Sort by ${
                  sort.options.find((option) => option.value === sort.field)?.label ?? sort.field
                }, ${sort.direction === 'asc' ? 'ascending' : 'descending'}. Change sorting`}
                className={cn('relative', compact ? 'size-8' : 'size-9')}
              >
                <ArrowUpDownIcon aria-hidden />
                {sort.activeCount ? <CountBadge count={sort.activeCount} /> : null}
              </Button>
            }
          />
        ) : null}

        {hideableColumns.length > 0 || exportFileName ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={compact ? 'size-8' : 'size-9'}
                  aria-label="Table options"
                />
              }
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Every part inside a group: Base UI reads its label, its
                  checkbox items and their roles off a group context, and a
                  bare item throws rather than degrading. */}
              {hideableColumns.length > 0 ? (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                    Columns
                  </DropdownMenuLabel>
                  {hideableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={columnVisibility[column.id] !== false}
                      closeOnClick={false}
                      onCheckedChange={(checked: boolean) =>
                        setColumnVisibility((previous) => ({ ...previous, [column.id]: checked }))
                      }
                    >
                      {column.header}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              ) : null}
              {hideableColumns.length > 0 && exportFileName ? <DropdownMenuSeparator /> : null}
              {exportFileName ? (
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleExport}>
                    <DownloadIcon aria-hidden />
                    Export CSV
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {primaryAction ? (
          // Text buttons take the height of the icon buttons beside them,
          // whatever size the caller asked for.
          <div
            className={cn(
              'flex items-center gap-2',
              compact ? '[&_[data-slot=button]]:h-8' : '[&_[data-slot=button]]:h-9',
            )}
          >
            {primaryAction}
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div
      role="region"
      aria-label={label}
      className={cn('flex w-full min-w-0 flex-col', compact ? 'gap-0' : 'gap-5', className)}
    >
      <Heading className="sr-only">{label}</Heading>
      {/* A list with nothing in it has nothing to search, filter or sort: the
          guided empty state stands alone until the first record exists. */}
      {showFirstRun || hideToolbar ? null : toolbar}

      {/* The frame: what the columns are scaled to fill. `min-w-0` is what
          stops an overflowing table pushing the page itself wider. */}
      <DataRegion
        state={{ refreshing: isRefreshing, provisional: isProvisional }}
        className="min-w-0"
      >
        <div
          ref={frameRef}
          data-slot="entity-list-frame"
          data-border={border ? '' : undefined}
          className={cn(
            'w-full min-w-0',
            border && 'bg-background overflow-hidden rounded-xl border',
          )}
        >
          {showFirstRun && empty ? (
            <GuidedEmptyState
              title={empty.title}
              description={empty.description}
              actions={empty.actions}
              guides={empty.guides}
              scene={empty.scene}
              label={`${label}: nothing here yet`}
            />
          ) : (
            <DataGrid
              table={table as never}
              recordCount={total}
              isLoading={isLoading}
              loadingMode="skeleton"
              {...(onRowClick ? { onRowClick } : {})}
              emptyMessage={
                isOutOfRange ? (
                  <EmptyState
                    size="inline"
                    isFiltered
                    {...(empty?.scene ? { scene: empty.scene } : {})}
                    title="This page is out of range"
                    description={`There are ${total} ${noun}, but none on page ${page}. Your records are all still here.`}
                    onClearFilters={
                      <Button type="button" variant="outline" size="sm" onClick={goToFirstPage}>
                        Go to first page
                      </Button>
                    }
                  />
                ) : isFiltered ? (
                  <EmptyState
                    size="inline"
                    isFiltered
                    {...(empty?.scene ? { scene: empty.scene } : {})}
                    title={filteredEmptyTitle ?? `No ${noun} match these filters`}
                    description={
                      filteredEmptyDescription ??
                      'Try a different search, or clear what is narrowing the list.'
                    }
                    {...(onClearFilters
                      ? {
                          onClearFilters: (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={onClearFilters}
                            >
                              Clear filters
                            </Button>
                          ),
                        }
                      : {})}
                  />
                ) : (
                  /* Neither filtered nor out of range: the list itself is empty.
                   Saying "match these filters" here would blame a filter that
                   does not exist. */
                  <EmptyState
                    size="inline"
                    isFiltered
                    {...(empty?.scene ? { scene: empty.scene } : {})}
                    title={empty?.title ?? `No ${noun}`}
                    {...(empty?.description ? { description: empty.description } : {})}
                  />
                )
              }
              tableLayout={{
                headerSticky: false,
                headerBackground: false,
                rowBorder: true,
                columnsVisibility: true,
                columnsPinnable: true,
                width: 'fixed',
              }}
              tableClassNames={{
                base: 'min-w-(--table-min)',
                edgeCell: compact ? 'first:ps-6 last:pe-4' : 'first:ps-4 last:pe-2',
                headerRow: cn(
                  'bg-muted/60 [&>th]:px-4 [&>th]:border-0',
                  compact
                    ? '[&>th]:h-9'
                    : cn(
                        '[&>th]:h-11',
                        // Inside a frame the outline already rounds the corners.
                        !border && '[&>th:first-child]:rounded-s-lg [&>th:last-child]:rounded-e-lg',
                      ),
                ),
                /*
                 * Every cell clips (`overflow-hidden`): `table-fixed` fixes the
                 * cell box, not its contents, so a pill or any other
                 * non-truncating child would paint past its column and inflate
                 * the scroll container. The cell helpers truncate their text;
                 * this is the backstop for the ones that cannot.
                 */
                bodyRow: cn(
                  compact ? 'h-12 [&_.font-medium]:font-[450]' : 'h-[60px]',
                  'hover:bg-muted/30 [&>td]:px-4 [&>td]:whitespace-nowrap [&>td]:border-border/40 [&>td]:overflow-hidden last:[&>td]:border-b-0',
                  onRowClick && 'cursor-pointer',
                ),
              }}
            >
              <DataGridContainer className="flex min-w-0 flex-col border-0 bg-transparent">
                <TableScroller minWidth={tableMin} scrolls={overflows}>
                  <DataGridTable />
                </TableScroller>
                {total > 0 && !hideFooter ? (
                  <div
                    className={cn(
                      'border-border/60 border-t',
                      compact ? 'px-6 py-3' : border ? 'px-4 py-3' : 'px-4 pt-4',
                    )}
                  >
                    <DataGridPagination
                      sizes={[...new Set([...PAGE_SIZES, pageSize])].sort((a, b) => a - b)}
                      info={`{from} - {to} of {count} ${noun}`}
                    />
                  </div>
                ) : null}
              </DataGridContainer>
            </DataGrid>
          )}
        </div>
      </DataRegion>
    </div>
  )
}

/** A row's `⋯`. Icon-only and 28px, so the column can be 40px wide. */
function RowActionsMenu({ actions }: { actions: EntityRowAction[] }) {
  if (actions.length === 0) return null
  const ordinary = actions.filter((action) => !action.destructive)
  const destructive = actions.filter((action) => action.destructive)

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Row actions"
              // The row is often clickable; opening its menu is not opening it.
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            {ordinary.map((action) => (
              <DropdownMenuItem
                key={action.label}
                disabled={action.disabled ?? false}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation()
                  action.onSelect()
                }}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {destructive.length > 0 && ordinary.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructive.length > 0 ? (
            <DropdownMenuGroup>
              {destructive.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  variant="destructive"
                  disabled={action.disabled ?? false}
                  onClick={(event: React.MouseEvent) => {
                    event.stopPropagation()
                    action.onSelect()
                  }}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

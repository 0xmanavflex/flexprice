import { useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpDownIcon, FilterIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  FilterBar,
  readSelectFilter,
  selectFilterField,
  type FlatFilter,
} from '@ui/compositions/tables/FilterBar'
import { SortMenu } from '@ui/compositions/tables/SortMenu'
import { SectionToolsContext } from '@ui/compositions/layout/Section'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { EntityList } from './EntityList'
import type { EntityColumn } from './cells'

/**
 * The list table, for rows a detail page already holds.
 *
 * A list page hands `EntityList` a server-paged slice and handlers for search,
 * sort and paging. A detail page has the whole set in memory, so this keeps
 * that state itself: search, a status facet, sort, page: and gives
 * `EntityList` exactly what a list page would. Same toolbar, same header band,
 * same rows, same footer; only the place the state lives is different.
 *
 * Borderless by default, because it usually sits inside a `Section` that
 * already frames it. `border` draws `EntityList`'s own outline instead, for a
 * table with nothing around it (a settings tab that is a table and nothing
 * else).
 */
export const DetailTableProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'The detail-page table. Inside a Section, filter and sort sit in the section header beside the action. The rows stay the shared list table.',
})

export interface DetailColumn<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Makes the header and the Sort menu order by this value. */
  sortBy?: (row: T) => string | number
  /** Plain text for search and CSV. Defaults to nothing; search also reads the row's own fields. */
  text?: (row: T) => string
  /** Preferred width in px; the table scales the set to fill. */
  width?: number
  /** Extra classes on the cell. */
  className?: string
  /** `end` right-aligns the header and the cell, for a document-shaped table. */
  align?: 'end'
  /** Off until turned on from the table's column menu. */
  hiddenByDefault?: boolean
}

export interface DetailTableProps<T> {
  rows: T[]
  columns: DetailColumn<T>[]
  /** Defaults to `row.id`. */
  getRowId?: (row: T) => string
  /** Names the table for assistive tech, e.g. "Recent invoices"; "table" is added so it never repeats the section's own name. */
  label: string
  /** The create button on the right of the toolbar, beside the filter. */
  action?: ReactNode
  /** For "1 - 10 of 24 invoices". */
  noun?: string
  onRowClick?: (row: T) => void
  /** Adds the filter button: rows are narrowed to the chosen values of this field. */
  facet?: { label: string; value: (row: T) => string }
  /** Several fields in the same filter, when one facet is not enough. */
  facets?: Array<{ id: string; label: string; value: (row: T) => string }>
  /** What the search matches. Defaults to the visible text of every column plus the row's own string fields. */
  searchText?: (row: T) => string
  pageSize?: number
  /** Shown in place of the table when there are no rows at all. */
  empty?: ReactNode
  /** Row heights and footer for a table that is the whole body of a `Section table`: no inset, 48px rows, a footer only past one page. */
  compact?: boolean
  /** `false` leaves out the search row, for a short list that needs none. */
  toolbar?: boolean
  /** `false` leaves out the page-size picker and range footer, for a set that is always shown whole. */
  footer?: boolean
  /** Draws a rounded outline around the rows. Off when a surrounding `Section` already frames it. */
  border?: boolean
  /** Skeleton rows while the set is still loading; `empty` waits until it has arrived. */
  isLoading?: boolean
  /**
   * A row that belongs to the row above it, such as a line an expanded row
   * opens: it is not counted in "1 - 10 of 24", and it pages with its parent
   * rather than pushing a record onto the next page.
   */
  isChild?: (row: T) => boolean
  className?: string
}

function plainText(row: object): string {
  return Object.values(row)
    .filter(
      (value): value is string | number => typeof value === 'string' || typeof value === 'number',
    )
    .join(' ')
}

export function DetailTable<T extends object>({
  rows,
  columns,
  getRowId,
  label,
  action,
  noun = 'records',
  onRowClick,
  facet,
  facets,
  searchText,
  pageSize: initialPageSize = 10,
  empty,
  compact = false,
  toolbar = true,
  footer = true,
  border = false,
  isLoading = false,
  isChild,
  className,
}: DetailTableProps<T>) {
  const toolsSlot = useContext(SectionToolsContext)
  const toolsEl = toolsSlot?.el ?? null
  // A titled section keeps filter and sort beside its title. A tab that is
  // only a table has no title: the tab is the name: so the search bar stays.
  const inHeader = Boolean(toolsEl) && Boolean(toolsSlot?.titled) && toolbar
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [sortState, setSortState] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(
    null,
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const idOf = (row: T, index: number) =>
    getRowId ? getRowId(row) : String((row as { id?: string }).id ?? index)

  const entityColumns = useMemo<EntityColumn<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        header: column.header,
        cell: column.cell,
        ...(column.text ? { text: column.text } : {}),
        // A column with no title is the row menu: narrow, always shown.
        ...(column.header ? {} : { fixed: true, width: column.width ?? 48, hideable: false }),
        ...(column.width && column.header ? { width: column.width } : {}),
        ...(column.sortBy ? { sortable: true } : {}),
        ...(column.className ? { cellClassName: column.className } : {}),
        ...(column.align ? { align: column.align } : {}),
        ...(column.hiddenByDefault ? { hiddenByDefault: true } : {}),
      })),
    [columns],
  )

  const specs = useMemo(() => {
    if (facets) return facets
    if (facet) return [{ id: 'status', label: facet.label, value: facet.value }]
    // No facet was named: offer any short column (a status, a plan) so every
    // detail table can filter from the header.
    return columns.flatMap((column) => {
      if (!column.text || !column.header) return []
      const values = new Set(rows.map((row) => column.text?.(row) ?? '').filter(Boolean))
      if (values.size < 2 || values.size > 8) return []
      return [{ id: column.key, label: column.header, value: column.text }]
    })
  }, [facets, facet, columns, rows])

  const choicesById = useMemo(() => {
    const out: Record<string, { value: string; label: string }[]> = {}
    for (const spec of specs) {
      out[spec.id] = [...new Set(rows.map((row) => spec.value(row)))]
        .filter((value) => value.length > 0)
        .map((value) => ({ value, label: value }))
    }
    return out
  }, [rows, specs])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    // Filters, search and sort act on whole records: a record with the child
    // rows beneath it (`isChild`). A child is never matched, kept or moved on
    // its own, so it can neither stand alone nor land under another record.
    let groups = rows.reduce<T[][]>((out, row) => {
      const last = out[out.length - 1]
      if (last && isChild?.(row)) last.push(row)
      else out.push([row])
      return out
    }, [])
    for (const spec of specs) {
      const chosen = selected[spec.id] ?? []
      if (chosen.length > 0) groups = groups.filter(([head]) => chosen.includes(spec.value(head!)))
    }
    if (needle) {
      const matches = (row: T) =>
        (searchText
          ? searchText(row)
          : `${plainText(row)} ${columns.map((column) => column.text?.(row) ?? '').join(' ')}`
        )
          .toLowerCase()
          .includes(needle)
      groups = groups.filter((group) => group.some(matches))
    }
    const sorting = sortState ? columns.find((column) => column.key === sortState.field) : null
    const by = sorting?.sortBy ?? sorting?.text
    if (sortState && by) {
      const sign = sortState.direction === 'asc' ? 1 : -1
      groups = [...groups].sort(([a], [b]) => {
        const left = by(a!)
        const right = by(b!)
        return (
          sign *
          (typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right)))
        )
      })
    }
    return groups.flat()
  }, [rows, columns, search, specs, selected, searchText, sortState, isChild])

  if (rows.length === 0 && empty && !isLoading) {
    return (
      <div className={className}>
        {action ? (
          <div className={cn('flex items-center justify-end', compact ? 'px-6 py-3' : 'px-4 pt-4')}>
            {action}
          </div>
        ) : null}
        <div
          className={cn(
            'text-muted-foreground p-6 text-sm',
            border && 'bg-background rounded-xl border',
          )}
        >
          {empty}
        </div>
      </div>
    )
  }

  const sortOptions = columns.flatMap((column) =>
    column.header && (column.sortBy || column.text)
      ? [{ value: column.key, label: column.header }]
      : [],
  )
  // Each record with the child rows beneath it: the unit that is counted and paged.
  const groups = visible.reduce<T[][]>((out, row) => {
    const last = out[out.length - 1]
    if (last && isChild?.(row)) last.push(row)
    else out.push([row])
    return out
  }, [])
  const start = (page - 1) * pageSize
  const slice = groups.slice(start, start + pageSize).flat()
  const activeSpecs = specs.filter((spec) => (choicesById[spec.id]?.length ?? 0) > 0)
  const isFiltered =
    search.trim().length > 0 || activeSpecs.some((spec) => (selected[spec.id]?.length ?? 0) > 0)
  const reset = () => {
    setSearch('')
    setSelected({})
    setPage(1)
  }

  const headerTools =
    inHeader && toolsEl
      ? createPortal(
          <>
            {activeSpecs.length > 0 ? (
              <FilterBar
                variant="advanced"
                advancedAlign="end"
                fields={activeSpecs.map((spec) =>
                  selectFilterField(spec.id, spec.label, choicesById[spec.id] ?? []),
                )}
                query={createFilterQuery(
                  activeSpecs.flatMap((spec) => {
                    const values = selected[spec.id] ?? []
                    return values.length > 0
                      ? [
                          createFilterRule({
                            id: spec.id,
                            path: [spec.id],
                            operator: 'is_any_of',
                            value: values,
                          }),
                        ]
                      : []
                  }),
                )}
                onQueryChange={(_query, flat: FlatFilter[]) => {
                  const next: Record<string, string[]> = {}
                  for (const spec of activeSpecs) {
                    const allowed = new Set(
                      (choicesById[spec.id] ?? []).map((choice) => choice.value),
                    )
                    next[spec.id] = readSelectFilter(flat, spec.id, allowed)
                  }
                  setSelected(next)
                  setPage(1)
                }}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Filter"
                  >
                    <FilterIcon aria-hidden />
                  </Button>
                }
              />
            ) : null}
            {sortOptions.length > 0 ? (
              <SortMenu
                align="end"
                options={sortOptions}
                field={sortState?.field || sortOptions[0]!.value}
                direction={sortState?.direction ?? 'asc'}
                onChange={(field, direction) => {
                  setSortState({ field, direction })
                  setPage(1)
                }}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Sort"
                  >
                    <ArrowUpDownIcon aria-hidden />
                  </Button>
                }
              />
            ) : null}
            {action}
          </>,
          toolsEl,
        )
      : null

  return (
    <div className={cn(!compact && 'p-4', className)}>
      {headerTools}
      <EntityList<T>
        compact={compact}
        border={border}
        isLoading={isLoading}
        hideToolbar={!toolbar || inHeader}
        // With its tools in the section header the table is usually short
        // enough to need no footer, but a longer one keeps its pager: rows are
        // sliced to one page, so without it the rest could not be reached.
        hideFooter={!footer || (inHeader && groups.length <= pageSize)}
        label={`${label} table`}
        noun={noun}
        rows={slice}
        total={groups.length}
        columns={entityColumns}
        getRowId={(row) => idOf(row, rows.indexOf(row))}
        page={page}
        pageSize={pageSize}
        onPaginationChange={(nextPage, nextSize) => {
          setPage(nextPage)
          setPageSize(nextSize)
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        searchPlaceholder={`Search ${noun}…`}
        {...(activeSpecs.length > 0
          ? {
              filter: {
                fields: activeSpecs.map((spec) =>
                  selectFilterField(spec.id, spec.label, choicesById[spec.id] ?? []),
                ),
                query: createFilterQuery(
                  activeSpecs.flatMap((spec) => {
                    const values = selected[spec.id] ?? []
                    return values.length > 0
                      ? [
                          createFilterRule({
                            id: spec.id,
                            path: [spec.id],
                            operator: 'is_any_of',
                            value: values,
                          }),
                        ]
                      : []
                  }),
                ),
                activeCount: activeSpecs.filter((spec) => (selected[spec.id]?.length ?? 0) > 0)
                  .length,
                onQueryChange: (_query, flat: FlatFilter[]) => {
                  const next: Record<string, string[]> = {}
                  for (const spec of activeSpecs) {
                    const allowed = new Set(
                      (choicesById[spec.id] ?? []).map((choice) => choice.value),
                    )
                    next[spec.id] = readSelectFilter(flat, spec.id, allowed)
                  }
                  setSelected(next)
                  setPage(1)
                },
              },
            }
          : {})}
        {...(!inHeader && sortOptions.length > 0
          ? {
              sort: {
                options: sortOptions,
                field: sortState?.field ?? '',
                direction: sortState?.direction ?? 'asc',
                activeCount: sortState ? 1 : 0,
                onChange: (field: string, direction: 'asc' | 'desc') => {
                  setSortState({ field, direction })
                  setPage(1)
                },
              },
            }
          : {})}
        {...(onRowClick ? { onRowClick } : {})}
        isFiltered={isFiltered}
        onClearFilters={reset}
        filteredEmptyTitle={`No ${noun} match these filters`}
        headingAs="h3"
        {...(action && !inHeader ? { primaryAction: action } : {})}
      />
    </div>
  )
}

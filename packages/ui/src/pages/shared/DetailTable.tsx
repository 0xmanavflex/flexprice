import { useMemo, useState, type ReactNode } from 'react'
import {
  readSelectFilter,
  selectFilterField,
  type FlatFilter,
} from '@ui/compositions/tables/FilterBar'
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
 * that state itself — search, a status facet, sort, page — and gives
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
  note: 'EntityList with client-side search, facet filter, sort and paging, in a bordered frame, for tables on detail pages.',
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
  className,
}: DetailTableProps<T>) {
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
      })),
    [columns],
  )

  const specs = useMemo(
    () => facets ?? (facet ? [{ id: 'status', label: facet.label, value: facet.value }] : []),
    [facets, facet],
  )

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
    let next = rows
    for (const spec of specs) {
      const chosen = selected[spec.id] ?? []
      if (chosen.length > 0) next = next.filter((row) => chosen.includes(spec.value(row)))
    }
    if (needle) {
      next = next.filter((row) => {
        const haystack = searchText
          ? searchText(row)
          : `${plainText(row)} ${columns.map((column) => column.text?.(row) ?? '').join(' ')}`
        return haystack.toLowerCase().includes(needle)
      })
    }
    const by = sortState ? columns.find((column) => column.key === sortState.field)?.sortBy : null
    if (sortState && by) {
      const sign = sortState.direction === 'asc' ? 1 : -1
      next = [...next].sort((a, b) => {
        const left = by(a)
        const right = by(b)
        return (
          sign *
          (typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right)))
        )
      })
    }
    return next
  }, [rows, columns, search, specs, selected, searchText, sortState])

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

  const sortable = columns.filter((column) => column.sortBy)
  const start = (page - 1) * pageSize
  const slice = visible.slice(start, start + pageSize)
  const activeSpecs = specs.filter((spec) => (choicesById[spec.id]?.length ?? 0) > 0)
  const isFiltered =
    search.trim().length > 0 || activeSpecs.some((spec) => (selected[spec.id]?.length ?? 0) > 0)
  const reset = () => {
    setSearch('')
    setSelected({})
    setPage(1)
  }

  return (
    <div className={cn(!compact && 'p-4', className)}>
      <EntityList<T>
        compact={compact}
        border={border}
        isLoading={isLoading}
        hideToolbar={!toolbar}
        hideFooter={!footer}
        label={`${label} table`}
        noun={noun}
        rows={slice}
        total={visible.length}
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
                    const allowed = new Set((choicesById[spec.id] ?? []).map((choice) => choice.value))
                    next[spec.id] = readSelectFilter(flat, spec.id, allowed)
                  }
                  setSelected(next)
                  setPage(1)
                },
              },
            }
          : {})}
        {...(sortable.length > 0
          ? {
              sort: {
                options: sortable.map((column) => ({ value: column.key, label: column.header })),
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
        {...(action ? { primaryAction: action } : {})}
      />
    </div>
  )
}

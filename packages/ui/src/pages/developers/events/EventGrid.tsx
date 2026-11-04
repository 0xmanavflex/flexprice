import { useMemo } from 'react'
import { BookOpenIcon, CopyIcon, RefreshCwIcon, ScrollTextIcon, SendIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import {
  DEFAULT_RAW_EVENT_QUERY,
  RAW_EVENT_PERIODS,
  type RawEvent,
  type RawEventQuery,
} from '@fp/domain'
import { EMPTY_CATALOGUE } from '@ui/compositions/feedback/emptyCatalogue'
import type { FlatFilter } from '@ui/compositions/tables/FilterBar'
import { createFilterQuery, createFilterRule } from '@ui/components/reui/filters/filters-query'
import type { FilterField, FilterNode } from '@ui/components/reui/filters/filters-types'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, EmDash, Tag, idColumn } from '../../shared/cells'

/**
 * The Events Debugger list, on the shared `EntityList`.
 *
 * Read-only by nature: an event is a record of something that already
 * happened, so there is no create action and no status. The search box matches
 * the event name and the filter builder takes a customer, a source and how far
 * back to look: all server-side filters on `POST /events/query`, so the list is
 * the page the server sent, not a page narrowed after the fact.
 *
 * The window always applies (the server reads a window even when none is
 * sent), so its chip is always shown and an empty list says "nothing in this
 * window", never "nothing received yet".
 */
export const EventGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Raw event columns and filters over the shared list table.',
})

/** `is` only: the one operator the request can express, and the one the URL can carry. */
const IS_OPERATOR = [{ value: 'is', label: 'is' }]

const FILTER_FIELDS: FilterField[] = [
  {
    id: 'customer',
    label: 'Customer ID',
    type: 'text',
    operators: IS_OPERATOR,
    defaultOperator: 'is',
    placeholder: 'External customer ID',
  },
  {
    id: 'source',
    label: 'Source',
    type: 'text',
    operators: IS_OPERATOR,
    defaultOperator: 'is',
    placeholder: 'e.g. sdk',
  },
  {
    id: 'period',
    label: 'Received',
    type: 'select',
    options: RAW_EVENT_PERIODS.map((period) => ({ value: period.id, label: period.label })),
    operators: [{ value: 'is', label: 'in' }],
    defaultOperator: 'is',
    searchable: false,
  },
]

const GUIDES: EntityGuide[] = [
  {
    title: 'Sending an event',
    description: 'The shape of a usage event and the one field that makes it idempotent.',
    href: 'https://docs.flexprice.io/api-reference/events/ingest-event',
    icon: <SendIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Sending events in bulk',
    description: 'Backfilling or batching usage without a request per event.',
    href: 'https://docs.flexprice.io/api-reference/events/bulk-ingest-events',
    icon: <ScrollTextIcon aria-hidden className="size-4" />,
  },
  {
    title: 'How events become usage',
    description: 'How a feature meters the events it receives.',
    href: 'https://docs.flexprice.io/docs/product-catalogue/features/use-cases',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

const SORT_OPTIONS = [{ value: 'timestamp', label: 'Time' }]

/** Date and time to the second: an ingest log is read to the second, unlike a catalogue. */
function formatTimestamp(value: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(value)
}

/** The properties as compact JSON, for the one-line cell and the CSV. */
function propertiesText(row: RawEvent): string {
  return Object.keys(row.properties).length > 0 ? JSON.stringify(row.properties) : ''
}

export interface EventGridProps {
  events: RawEvent[]
  /** Server-side total. Drives the record count and page count. */
  total: number
  query: RawEventQuery
  onQueryChange: (query: RawEventQuery) => void
  isLoading?: boolean
  /** Already a message; the grid does not know what an ApiError is. */
  error?: string | null
  onRetry?: () => void
  /** Opens the event. Also wired to the row's "View event" action. */
  onEventClick?: (event: RawEvent) => void
  onClearFilters?: () => void
  /** Fetches the newest events again. Events land a moment after they are sent. */
  onReload?: () => void
  isReloading?: boolean
  locale?: string
}

export function EventGrid({
  events,
  total,
  query,
  onQueryChange,
  isLoading = false,
  error = null,
  onRetry,
  onEventClick,
  onClearFilters,
  onReload,
  isReloading = false,
  locale,
}: EventGridProps) {
  const columns = useMemo<EntityColumn<RawEvent>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: (row) =>
          row.timestamp ? (
            <span className="block truncate font-mono text-xs">
              {formatTimestamp(row.timestamp, locale)}
            </span>
          ) : (
            <EmDash />
          ),
        text: (row) => (row.timestamp ? formatTimestamp(row.timestamp, locale) : ''),
        width: 200,
        sortable: true,
        sortValue: 'timestamp',
      },
      {
        id: 'eventName',
        header: 'Event',
        cell: (row) =>
          row.eventName ? (
            <code className="text-foreground/80 block truncate font-mono text-xs">
              {row.eventName}
            </code>
          ) : (
            <EmDash />
          ),
        text: (row) => row.eventName,
        width: 220,
        hideable: false,
      },
      idColumn<RawEvent>('customer', 'Customer ID', (row) => row.externalCustomerId, {
        width: 180,
      }),
      {
        id: 'properties',
        header: 'Properties',
        cell: (row) => {
          const text = propertiesText(row)
          return text ? (
            <span title={text} className="text-muted-foreground block truncate font-mono text-xs">
              {text}
            </span>
          ) : (
            <EmDash />
          )
        },
        text: propertiesText,
        width: 320,
      },
      {
        id: 'source',
        header: 'Source',
        cell: (row) => (row.source ? <Tag>{row.source}</Tag> : <EmDash />),
        text: (row) => row.source,
        width: 120,
      },
      idColumn<RawEvent>('id', 'Event ID', (row) => row.id, { width: 200 }),
    ],
    [locale],
  )

  const filterRules: FilterNode[] = []
  if (query.customer) {
    filterRules.push(
      createFilterRule({
        id: 'customer',
        path: ['customer'],
        operator: 'is',
        value: query.customer,
      }),
    )
  }
  if (query.source) {
    filterRules.push(
      createFilterRule({ id: 'source', path: ['source'], operator: 'is', value: query.source }),
    )
  }
  filterRules.push(
    createFilterRule({ id: 'period', path: ['period'], operator: 'is', value: query.period }),
  )
  const isNarrowed = query.search.length > 0 || query.customer.length > 0 || query.source.length > 0
  const periodLabel =
    RAW_EVENT_PERIODS.find((period) => period.id === query.period)?.label.toLowerCase() ??
    'chosen window'

  const rowActions = (event: RawEvent): EntityRowAction[] => {
    const actions: EntityRowAction[] = []
    if (onEventClick) {
      actions.push({
        label: 'View event',
        readOnly: true,
        icon: <ScrollTextIcon aria-hidden className="size-4" />,
        onSelect: () => onEventClick(event),
      })
    }
    actions.push({
      label: 'Copy event ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(event.id),
    })
    return actions
  }

  return (
    <EntityList<RawEvent>
      label="Events"
      noun="events"
      rows={events}
      total={total}
      columns={columns}
      getRowId={(event) => event.id}
      page={query.page}
      pageSize={query.pageSize}
      onPaginationChange={(page, pageSize) => onQueryChange({ ...query, page, pageSize })}
      search={query.search}
      onSearchChange={(search) => onQueryChange({ ...query, search, page: 1 })}
      searchPlaceholder="Search by event name…"
      filter={{
        fields: FILTER_FIELDS,
        query: createFilterQuery(filterRules),
        activeCount:
          (query.customer ? 1 : 0) +
          (query.source ? 1 : 0) +
          (query.period === DEFAULT_RAW_EVENT_QUERY.period ? 0 : 1),
        onQueryChange: (_next, flat: FlatFilter[]) => {
          const read = (field: string) =>
            String(flat.find((e) => e.field === field)?.values?.[0] ?? '').trim()
          const period =
            RAW_EVENT_PERIODS.find((option) => option.id === read('period'))?.id ??
            DEFAULT_RAW_EVENT_QUERY.period
          onQueryChange({
            ...query,
            customer: read('customer'),
            source: read('source'),
            period,
            page: 1,
          })
        },
      }}
      sort={{
        options: SORT_OPTIONS,
        field: 'timestamp',
        direction: query.sortDirection,
        activeCount: query.sortDirection === DEFAULT_RAW_EVENT_QUERY.sortDirection ? 0 : 1,
        onChange: (_field, sortDirection) => onQueryChange({ ...query, sortDirection, page: 1 }),
      }}
      rowActions={rowActions}
      {...(onReload
        ? {
            primaryAction: (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={onReload}
                disabled={isReloading}
              >
                <RefreshCwIcon aria-hidden className={cn(isReloading && 'animate-spin')} />
                Reload
              </Button>
            ),
          }
        : {})}
      exportFileName="events"
      {...(onEventClick ? { onRowClick: onEventClick } : {})}
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      // The window always narrows the list: an empty page is never proof that
      // no event was ever received.
      isFiltered
      {...(onClearFilters && isNarrowed ? { onClearFilters } : {})}
      filteredEmptyTitle={
        isNarrowed ? 'No events match these filters' : `No events in the ${periodLabel}`
      }
      {...(isNarrowed
        ? {}
        : {
            filteredEmptyDescription:
              'Older events are not shown: to look further back, change Received under Filter. An event also takes a moment to land after it is sent.',
          })}
      empty={{
        scene: 'developers',
        title: EMPTY_CATALOGUE.events.title,
        description:
          'Usage events sent by your systems appear here as they arrive, so a bill can be traced to what caused it.',
        guides: GUIDES,
      }}
    />
  )
}

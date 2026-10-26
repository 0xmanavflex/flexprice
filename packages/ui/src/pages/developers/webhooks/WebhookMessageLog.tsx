import { useMemo, useState } from 'react'
import { CopyIcon, FileJsonIcon, RefreshCwIcon } from '@ui/icons'
import type { WebhookMessage } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import type { ErrorKind } from '@ui/compositions/feedback/States'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, idColumn } from '../../shared/cells'
import { EventTypeName, timestampColumn } from './webhookCells'

/**
 * Every message this environment sent: Svix's "Logs".
 *
 * Newest first, filtered server-side by event type. Clicking a row opens the
 * message with its payload and every attempt across endpoints.
 */
export const WebhookMessageLogProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Svix message log over the shared list table, filtered by event type.',
})

export interface WebhookMessageLogProps {
  messages: WebhookMessage[]
  /** Names for the event-type filter. */
  eventTypes: string[]
  /** `''` for every event type. */
  eventType: string
  onEventTypeChange: (eventType: string) => void
  isLoading?: boolean
  error?: string | null
  errorKind?: ErrorKind | undefined
  onRetry?: () => void
  isRetrying?: boolean | undefined
  /** A background request is updating the rows on screen. */
  isRefreshing?: boolean | undefined
  onRefresh?: () => void
  onOpen: (message: WebhookMessage) => void
  locale?: string
}

const ALL = 'all'

export function WebhookMessageLog({
  messages,
  eventTypes,
  eventType,
  onEventTypeChange,
  isLoading = false,
  error = null,
  errorKind,
  onRetry,
  isRetrying,
  isRefreshing,
  onRefresh,
  onOpen,
  locale,
}: WebhookMessageLogProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return messages
    return messages.filter((message) =>
      [message.id, message.eventId, message.eventType].some((field) =>
        field.toLowerCase().includes(term),
      ),
    )
  }, [messages, search])

  const columns = useMemo<EntityColumn<WebhookMessage>[]>(
    () => [
      {
        id: 'eventType',
        header: 'Event type',
        cell: (row) => <EventTypeName name={row.eventType} />,
        text: (row) => row.eventType,
        width: 280,
        hideable: false,
      },
      idColumn<WebhookMessage>('id', 'Message ID', (row) => row.id, { width: 240 }),
      idColumn<WebhookMessage>('eventId', 'Event ID', (row) => row.eventId, {
        width: 200,
        hiddenByDefault: true,
      }),
      timestampColumn<WebhookMessage>('timestamp', 'Timestamp', (row) => row.timestamp, locale),
    ],
    [locale],
  )

  const rowActions = (row: WebhookMessage): EntityRowAction[] => [
    {
      label: 'View message',
      readOnly: true,
      icon: <FileJsonIcon aria-hidden className="size-4" />,
      onSelect: () => onOpen(row),
    },
    {
      label: 'Copy message ID',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(row.id),
    },
  ]

  const choices = [
    { value: ALL, label: 'All event types' },
    ...eventTypes.map((name) => ({ value: name, label: name })),
  ]

  return (
    <EntityList<WebhookMessage>
      primaryActionReadOnly
      label="Message log"
      noun="messages"
      rows={filtered.slice((page - 1) * pageSize, page * pageSize)}
      total={filtered.length}
      columns={columns}
      getRowId={(row) => row.id}
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
      searchPlaceholder="Search by message or event ID…"
      filter={singleChoiceFilter<string>({
        id: 'eventType',
        label: 'Event type',
        value: eventType || ALL,
        empty: ALL,
        choices,
        onChange: (next) => {
          onEventTypeChange(next === ALL ? '' : next)
          setPage(1)
        },
      })}
      {...(onRefresh
        ? {
            primaryAction: (
              <Button variant="outline" onClick={onRefresh}>
                <RefreshCwIcon aria-hidden />
                Refresh
              </Button>
            ),
          }
        : {})}
      onRowClick={onOpen}
      rowActions={rowActions}
      exportFileName="webhook-messages"
      isLoading={isLoading}
      error={error}
      {...(errorKind ? { errorKind } : {})}
      {...(onRetry ? { onRetry } : {})}
      {...(isRetrying !== undefined ? { isRetrying } : {})}
      {...(isRefreshing !== undefined ? { isRefreshing } : {})}
      isFiltered={search.trim().length > 0 || eventType.length > 0}
      onClearFilters={() => {
        setSearch('')
        onEventTypeChange('')
      }}
      filteredEmptyTitle="No messages match these filters"
      headingAs="h3"
      empty={{
        scene: 'developers',
        title: 'No messages yet',
        description:
          'Every event Flexprice sends to your endpoints is logged here, with its payload and each delivery attempt.',
      }}
    />
  )
}

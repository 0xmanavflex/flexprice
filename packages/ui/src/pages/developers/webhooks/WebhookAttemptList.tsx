import { useMemo, useState } from 'react'
import { FileJsonIcon, RefreshCwIcon, RotateCcwIcon } from '@ui/icons'
import type { WebhookEndpointMessage, WebhookStatusFilter } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { singleChoiceFilter } from '@ui/compositions/tables/FilterBar'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityRowAction } from '../../shared/EntityList'
import { type EntityColumn, idColumn } from '../../shared/cells'
import {
  EventTypeName,
  WEBHOOK_STATUS_CHOICES,
  statusColumn,
  timestampColumn,
} from './webhookCells'

/**
 * An endpoint's "Message Attempts" table, as Svix's endpoint page has it.
 *
 * Each row is a message the endpoint was sent, with its latest status there;
 * the status filter is a server-side filter. Clicking a row opens the message
 * (payload and every attempt); the row menu resends it to this endpoint.
 */
export const WebhookAttemptListProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Svix endpoint message attempts over the shared list table, with a status filter and resend.',
})

export interface WebhookAttemptListProps {
  messages: WebhookEndpointMessage[]
  status: WebhookStatusFilter
  onStatusChange: (status: WebhookStatusFilter) => void
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onRefresh?: () => void
  onOpen: (message: WebhookEndpointMessage) => void
  onResend?: (message: WebhookEndpointMessage) => void
  locale?: string
}

export function WebhookAttemptList({
  messages,
  status,
  onStatusChange,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  onOpen,
  onResend,
  locale,
}: WebhookAttemptListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return messages
    return messages.filter((message) =>
      [message.eventType, message.id, message.eventId].some((field) =>
        field.toLowerCase().includes(term),
      ),
    )
  }, [messages, search])

  const columns = useMemo<EntityColumn<WebhookEndpointMessage>[]>(
    () => [
      statusColumn<WebhookEndpointMessage>((row) => row.status),
      {
        id: 'eventType',
        header: 'Event type',
        cell: (row) => <EventTypeName name={row.eventType} />,
        text: (row) => row.eventType,
        width: 240,
      },
      idColumn<WebhookEndpointMessage>('id', 'Message ID', (row) => row.id, { width: 220 }),
      timestampColumn<WebhookEndpointMessage>(
        'timestamp',
        'Timestamp',
        (row) => row.timestamp,
        locale,
      ),
    ],
    [locale],
  )

  const rowActions = (row: WebhookEndpointMessage): EntityRowAction[] => [
    {
      label: 'View message',
      readOnly: true,
      icon: <FileJsonIcon aria-hidden className="size-4" />,
      onSelect: () => onOpen(row),
    },
    ...(onResend
      ? [
          {
            label: 'Resend',
            icon: <RotateCcwIcon aria-hidden className="size-4" />,
            onSelect: () => onResend(row),
          },
        ]
      : []),
  ]

  return (
    <EntityList<WebhookEndpointMessage>
      primaryActionReadOnly
      label="Messages sent to this endpoint"
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
      searchPlaceholder="Search by event type or message ID…"
      filter={singleChoiceFilter<WebhookStatusFilter>({
        id: 'status',
        label: 'Status',
        value: status,
        empty: 'all',
        choices: WEBHOOK_STATUS_CHOICES,
        onChange: (next) => {
          onStatusChange(next)
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
      isLoading={isLoading}
      error={error}
      {...(onRetry ? { onRetry } : {})}
      isFiltered={search.trim().length > 0 || status !== 'all'}
      onClearFilters={() => {
        setSearch('')
        onStatusChange('all')
      }}
      filteredEmptyTitle="No messages match these filters"
      headingAs="h3"
      compact
      empty={{
        scene: 'developers',
        title: 'No messages sent yet',
        description:
          'Messages appear here once an event this endpoint subscribes to happens. Send an example from the Testing tab to see one now.',
      }}
    />
  )
}

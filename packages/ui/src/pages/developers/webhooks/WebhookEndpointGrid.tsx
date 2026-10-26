import { useMemo, useState } from 'react'
import {
  BookOpenIcon,
  CopyIcon,
  LayoutListIcon,
  PlusIcon,
  PowerIcon,
  ShieldCheckIcon,
  Trash2Icon,
  WebhookIcon,
} from '@ui/icons'
import { type WebhookEndpoint, type WebhookEndpointStats, webhookErrorRate } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Skeleton } from '@ui/components/primitives/skeleton'
import type { ErrorKind } from '@ui/compositions/feedback/States'
import { provenance } from '@ui/provenance'
import { EntityList, type EntityGuide, type EntityRowAction } from '../../shared/EntityList'
import { EntityCell, type EntityColumn, dateColumn, pillColumn } from '../../shared/cells'

/**
 * The Endpoints list: the first screen of Svix's app portal.
 *
 * One row per endpoint: its URL (with the description beneath, as Svix shows
 * it), whether it is enabled, what it subscribes to, and its error rate over
 * Svix's stats window. Svix lists endpoints by cursor with no total, so the page
 * loads them all (an environment has a handful) and this pages and searches in
 * memory.
 */
export const WebhookEndpointGridProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityList'],
  note: 'Svix app-portal endpoint list over the shared list table.',
})

const GUIDES: EntityGuide[] = [
  {
    title: 'Receiving webhooks',
    description: 'How Flexprice delivers events, and what a delivery looks like.',
    href: 'https://docs.flexprice.io/docs/webhooks/overview',
    icon: <WebhookIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Verifying signatures',
    description: 'Checking the signing secret on every request you receive.',
    href: 'https://docs.svix.com/receiving/verifying-payloads/how',
    icon: <ShieldCheckIcon aria-hidden className="size-4" />,
  },
  {
    title: 'Event catalog',
    description: 'Every event type Flexprice sends, with an example payload.',
    href: 'https://docs.flexprice.io/docs/webhooks/overview',
    icon: <BookOpenIcon aria-hidden className="size-4" />,
  },
]

export interface WebhookEndpointGridProps {
  endpoints: WebhookEndpoint[]
  /** Delivery counts by endpoint id. Missing entries render a placeholder. */
  stats?: Record<string, WebhookEndpointStats> | undefined
  isLoading?: boolean
  error?: string | null
  /** Why `error` happened; picks the figure and withholds retry for `denied`. */
  errorKind?: ErrorKind | undefined
  onRetry?: () => void
  isRetrying?: boolean | undefined
  onOpen: (endpoint: WebhookEndpoint) => void
  onCreate: () => void
  onViewCatalog?: () => void
  onToggleDisabled?: (endpoint: WebhookEndpoint) => void
  onDelete?: (endpoint: WebhookEndpoint) => void
  locale?: string
}

const PAGE_SIZE = 25

export function WebhookEndpointGrid({
  endpoints,
  stats,
  isLoading = false,
  error = null,
  errorKind,
  onRetry,
  isRetrying,
  onOpen,
  onCreate,
  onViewCatalog,
  onToggleDisabled,
  onDelete,
  locale,
}: WebhookEndpointGridProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return endpoints
    return endpoints.filter((endpoint) =>
      [endpoint.url, endpoint.description, endpoint.id].some((field) =>
        field.toLowerCase().includes(term),
      ),
    )
  }, [endpoints, search])

  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const columns = useMemo<EntityColumn<WebhookEndpoint>[]>(
    () => [
      {
        id: 'url',
        header: 'Endpoint',
        cell: (row) => (
          <EntityCell name={row.url} {...(row.description ? { sub: row.description } : {})} />
        ),
        text: (row) => row.url,
        width: 360,
        hideable: false,
        skeleton: <Skeleton className="h-4 w-56" />,
      },
      pillColumn<WebhookEndpoint>(
        'state',
        'Status',
        (row) =>
          row.disabled
            ? { label: 'Disabled', tone: 'neutral' }
            : { label: 'Enabled', tone: 'success' },
        { width: 120 },
      ),
      {
        id: 'events',
        header: 'Subscribed to',
        cell: (row) => (
          <span className="text-muted-foreground block truncate">{subscriptionText(row)}</span>
        ),
        text: subscriptionText,
        width: 170,
      },
      {
        id: 'errorRate',
        header: 'Error rate',
        cell: (row) => {
          const entry = stats?.[row.id]
          if (!entry) return <Skeleton className="h-4 w-10" />
          const rate = webhookErrorRate(entry)
          return (
            <span className="text-muted-foreground tabular-nums">
              {rate === null ? (
                // No deliveries is not a 0% error rate: nothing was measured.
                <span title="No deliveries yet">
                  <span aria-hidden>—</span>
                  <span className="sr-only">No deliveries yet</span>
                </span>
              ) : (
                `${Number(rate.toFixed(1))}%`
              )}
            </span>
          )
        },
        text: (row) => {
          const entry = stats?.[row.id]
          const rate = entry ? webhookErrorRate(entry) : null
          return rate === null ? '' : `${rate.toFixed(1)}%`
        },
        width: 110,
      },
      dateColumn<WebhookEndpoint>('created', 'Created', (row) => row.createdAt, {
        width: 140,
        ...(locale ? { locale } : {}),
      }),
    ],
    [stats, locale],
  )

  const rowActions = (row: WebhookEndpoint): EntityRowAction[] => [
    {
      label: 'Open endpoint',
      readOnly: true,
      icon: <LayoutListIcon aria-hidden className="size-4" />,
      onSelect: () => onOpen(row),
    },
    {
      label: 'Copy URL',
      readOnly: true,
      icon: <CopyIcon aria-hidden className="size-4" />,
      onSelect: () => void navigator.clipboard?.writeText(row.url),
    },
    ...(onToggleDisabled
      ? [
          {
            label: row.disabled ? 'Enable endpoint' : 'Disable endpoint',
            icon: <PowerIcon aria-hidden className="size-4" />,
            onSelect: () => onToggleDisabled(row),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: 'Delete endpoint',
            icon: <Trash2Icon aria-hidden className="size-4" />,
            destructive: true,
            onSelect: () => onDelete(row),
          },
        ]
      : []),
  ]

  const createButton = (
    <Button onClick={onCreate}>
      <PlusIcon aria-hidden />
      Add endpoint
    </Button>
  )

  return (
    <EntityList<WebhookEndpoint>
      label="Webhook endpoints"
      noun="endpoints"
      rows={rows}
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
      searchPlaceholder="Search by URL or description…"
      primaryAction={createButton}
      onRowClick={onOpen}
      rowActions={rowActions}
      isLoading={isLoading}
      error={error}
      {...(errorKind ? { errorKind } : {})}
      {...(onRetry ? { onRetry } : {})}
      {...(isRetrying !== undefined ? { isRetrying } : {})}
      isFiltered={search.trim().length > 0}
      onClearFilters={() => setSearch('')}
      filteredEmptyTitle="No endpoints match this search"
      headingAs="h3"
      empty={{
        scene: 'developers',
        title: 'No endpoints yet',
        description:
          'An endpoint is a URL Flexprice sends events to. Add one to start receiving invoice, payment and subscription events as they happen.',
        ...(onViewCatalog
          ? {
              secondaryAction: (
                <Button variant="outline" onClick={onViewCatalog}>
                  Browse event catalog
                </Button>
              ),
            }
          : {}),
        guides: GUIDES,
      }}
    />
  )
}

function subscriptionText(endpoint: WebhookEndpoint): string {
  const count = endpoint.filterTypes.length
  if (count === 0) return 'All events'
  if (count === 1) return endpoint.filterTypes[0] ?? '1 event'
  return `${count} events`
}

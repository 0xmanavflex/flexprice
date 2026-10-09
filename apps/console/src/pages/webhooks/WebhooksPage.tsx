import { useMemo, useState } from 'react'
import type { WebhookEndpoint } from '@fp/domain'
import {
  useDeleteWebhookEndpoint,
  useUpdateWebhookEndpoint,
  useWebhookActivity,
  useWebhookEndpointStats,
  useWebhookEndpoints,
  useWebhookEventTypes,
  useWebhookMessages,
} from '@fp/query'
import { ConfirmDialog, PageBody, ResourceNavigation } from '@fp/ui/compositions'
import {
  WebhookActivity,
  WebhookEndpointGrid,
  WebhookEventCatalog,
  WebhookMessageLog,
  toast,
} from '@fp/ui/pages'
import type { WebhookHubTab } from '@/app/webhookSearch'
import { WebhookMessagePanel } from './WebhookMessagePanel'
import { WebhookPortalGate } from './WebhookPortalGate'
import { toWebhookFailure } from './webhookFailure'

export interface WebhooksPageProps {
  tab: WebhookHubTab
  onTabChange: (tab: WebhookHubTab) => void
  /** The message whose sheet is open, from `?msg=`. */
  messageId: string | undefined
  onMessageChange: (messageId: string | undefined) => void
  onOpenEndpoint: (endpointId: string) => void
  onCreate: () => void
}

/**
 * Developers → Webhooks: the Svix consumer app portal, in the console.
 *
 * Mirrors V1's portal (`WebhooksPortal`): Endpoints, Event catalog, Logs and
 * Activity, each a view of the same Svix application. The view is in the URL;
 * so is an open message.
 */
export function WebhooksPage(props: WebhooksPageProps) {
  return (
    <WebhookPortalGate>
      {(environmentId) => <Hub {...props} environmentId={environmentId} />}
    </WebhookPortalGate>
  )
}

function Hub({
  environmentId,
  tab,
  onTabChange,
  messageId,
  onMessageChange,
  onOpenEndpoint,
  onCreate,
}: WebhooksPageProps & { environmentId: string }) {
  const endpoints = useWebhookEndpoints(environmentId)
  const rows = useMemo(() => endpoints.data ?? [], [endpoints.data])
  const ids = useMemo(() => rows.map((row) => row.id), [rows])

  return (
    <PageBody>
      <ResourceNavigation
        label="Webhook views"
        value={tab}
        onChange={(next) => onTabChange(next as WebhookHubTab)}
        items={[
          {
            id: 'endpoints',
            label: 'Endpoints',
            ...(endpoints.data ? { count: rows.length } : {}),
          },
          { id: 'catalog', label: 'Event catalog' },
          { id: 'logs', label: 'Logs' },
          { id: 'activity', label: 'Activity' },
        ]}
      />
      {tab === 'endpoints' ? (
        <EndpointsView
          environmentId={environmentId}
          endpoints={rows}
          ids={ids}
          isLoading={endpoints.isPending}
          error={toWebhookFailure(endpoints.error, 'your endpoints')}
          onRetry={() => void endpoints.refetch()}
          onOpenEndpoint={onOpenEndpoint}
          onCreate={onCreate}
          onViewCatalog={() => onTabChange('catalog')}
        />
      ) : tab === 'catalog' ? (
        <CatalogView environmentId={environmentId} />
      ) : tab === 'logs' ? (
        <LogsView
          environmentId={environmentId}
          messageId={messageId}
          onMessageChange={onMessageChange}
        />
      ) : (
        <ActivityView
          environmentId={environmentId}
          ids={ids}
          endpointsLoading={endpoints.isPending}
        />
      )}
    </PageBody>
  )
}

function EndpointsView({
  environmentId,
  endpoints,
  ids,
  isLoading,
  error,
  onRetry,
  onOpenEndpoint,
  onCreate,
  onViewCatalog,
}: {
  environmentId: string
  endpoints: WebhookEndpoint[]
  ids: string[]
  isLoading: boolean
  error: { message: string; canRetry: boolean } | null
  onRetry: () => void
  onOpenEndpoint: (id: string) => void
  onCreate: () => void
  onViewCatalog: () => void
}) {
  const stats = useWebhookEndpointStats(environmentId, ids)
  const update = useUpdateWebhookEndpoint(environmentId)
  const remove = useDeleteWebhookEndpoint(environmentId)
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null)

  return (
    <>
      <WebhookEndpointGrid
        endpoints={endpoints}
        {...(stats.data ? { stats: stats.data } : {})}
        isLoading={isLoading}
        error={error?.message ?? null}
        {...(error?.canRetry ? { onRetry } : {})}
        onOpen={(endpoint) => onOpenEndpoint(endpoint.id)}
        onCreate={onCreate}
        onViewCatalog={onViewCatalog}
        onToggleDisabled={(endpoint) =>
          update.mutate(
            { endpoint, patch: { disabled: !endpoint.disabled } },
            {
              onSuccess: () =>
                toast.success(endpoint.disabled ? 'Endpoint enabled' : 'Endpoint disabled'),
              onError: (failure) => toast.error(failure.message),
            },
          )
        }
        onDelete={setDeleting}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title="Delete this endpoint?"
        description={`Flexprice stops sending events to ${deleting?.url ?? 'it'}. This cannot be undone.`}
        confirmLabel="Delete endpoint"
        destructive
        isPending={remove.isPending}
        error={remove.error?.message ?? null}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Endpoint deleted')
              setDeleting(null)
            },
          })
        }
      />
    </>
  )
}

function CatalogView({ environmentId }: { environmentId: string }) {
  const eventTypes = useWebhookEventTypes(environmentId)
  return (
    <WebhookEventCatalog
      eventTypes={eventTypes.data ?? []}
      isLoading={eventTypes.isPending}
      error={toWebhookFailure(eventTypes.error, 'the event catalog')?.message ?? null}
    />
  )
}

function LogsView({
  environmentId,
  messageId,
  onMessageChange,
}: {
  environmentId: string
  messageId: string | undefined
  onMessageChange: (messageId: string | undefined) => void
}) {
  const [eventType, setEventType] = useState('')
  const messages = useWebhookMessages(environmentId, eventType)
  const eventTypes = useWebhookEventTypes(environmentId)
  const failure = toWebhookFailure(messages.error, 'the message log')
  const rows = messages.data ?? []

  return (
    <>
      <WebhookMessageLog
        messages={rows}
        eventTypes={(eventTypes.data ?? []).map((entry) => entry.name)}
        eventType={eventType}
        onEventTypeChange={setEventType}
        isLoading={messages.isPending}
        error={failure?.message ?? null}
        {...(failure?.canRetry ? { onRetry: () => void messages.refetch() } : {})}
        onRefresh={() => void messages.refetch()}
        onOpen={(message) => onMessageChange(message.id)}
      />
      <WebhookMessagePanel
        environmentId={environmentId}
        messageId={messageId ?? null}
        known={rows.find((row) => row.id === messageId)}
        onClose={() => onMessageChange(undefined)}
      />
    </>
  )
}

function ActivityView({
  environmentId,
  ids,
  endpointsLoading,
}: {
  environmentId: string
  ids: string[]
  endpointsLoading: boolean
}) {
  const activity = useWebhookActivity(environmentId, ids)
  return (
    <WebhookActivity
      points={activity.data ?? []}
      isLoading={endpointsLoading || (ids.length > 0 && activity.isPending)}
      error={toWebhookFailure(activity.error, 'webhook activity')?.message ?? null}
      truncated={ids.length > 25}
    />
  )
}

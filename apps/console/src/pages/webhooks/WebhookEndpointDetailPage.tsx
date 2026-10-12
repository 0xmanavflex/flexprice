import { useState } from 'react'
import type { WebhookStatusFilter } from '@fp/domain'
import {
  ApiError,
  useDeleteWebhookEndpoint,
  usePatchWebhookEndpointHeaders,
  useRecoverWebhookEndpoint,
  useResendWebhookMessage,
  useRotateWebhookEndpointSecret,
  useSendWebhookExample,
  useUpdateWebhookEndpoint,
  useWebhookEndpoint,
  useWebhookEndpointHeaders,
  useWebhookEndpointMessages,
  useWebhookEndpointSecret,
  useWebhookEndpointStats,
  useWebhookEventTypes,
} from '@fp/query'
import { ErrorState, PageLoadingState } from '@fp/ui/compositions'
import { WebhookAttemptList, WebhookEndpointDetail, toast } from '@fp/ui/pages'
import type { WebhookEndpointTabParam } from '@/app/webhookSearch'
import { WebhookMessagePanel } from './WebhookMessagePanel'
import { WebhookPortalGate } from './WebhookPortalGate'
import { toWebhookFailure, writeError } from './webhookFailure'

export interface WebhookEndpointDetailPageProps {
  endpointId: string
  tab: WebhookEndpointTabParam
  onTabChange: (tab: WebhookEndpointTabParam) => void
  messageId: string | undefined
  onMessageChange: (messageId: string | undefined) => void
  onBack: () => void
}

/** One endpoint, wired: the Svix endpoint page with its attempts and message sheet. */
export function WebhookEndpointDetailPage(props: WebhookEndpointDetailPageProps) {
  return (
    <WebhookPortalGate>
      {(environmentId) => <EndpointDetail {...props} environmentId={environmentId} />}
    </WebhookPortalGate>
  )
}

function EndpointDetail({
  environmentId,
  endpointId,
  tab,
  onTabChange,
  messageId,
  onMessageChange,
  onBack,
}: WebhookEndpointDetailPageProps & { environmentId: string }) {
  const endpoint = useWebhookEndpoint(environmentId, endpointId)
  const stats = useWebhookEndpointStats(environmentId, [endpointId])
  const eventTypes = useWebhookEventTypes(environmentId)
  const headers = useWebhookEndpointHeaders(environmentId, endpointId)
  const [revealed, setRevealed] = useState(false)
  const secret = useWebhookEndpointSecret(environmentId, endpointId, revealed)
  const [status, setStatus] = useState<WebhookStatusFilter>('all')
  const messages = useWebhookEndpointMessages(environmentId, endpointId, status)

  const update = useUpdateWebhookEndpoint(environmentId)
  const remove = useDeleteWebhookEndpoint(environmentId)
  const recover = useRecoverWebhookEndpoint(environmentId)
  const rotate = useRotateWebhookEndpointSecret(environmentId)
  const patchHeaders = usePatchWebhookEndpointHeaders(environmentId)
  const sendExample = useSendWebhookExample(environmentId)
  const resend = useResendWebhookMessage(environmentId)

  if (endpoint.isPending) return <PageLoadingState variant="detail" label="Loading endpoint" />

  if (endpoint.error || !endpoint.data) {
    const failure = toWebhookFailure(endpoint.error, 'this endpoint')
    return (
      <ErrorState
        variant="page"
        title={
          endpoint.error instanceof ApiError && endpoint.error.kind === 'not_found'
            ? 'This endpoint no longer exists'
            : 'This endpoint could not be loaded'
        }
        {...(failure ? { description: failure.message, kind: failure.kind } : {})}
        isRetrying={endpoint.isFetching}
        {...(failure?.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {})}
        {...(failure?.canRetry ? { onRetry: () => void endpoint.refetch() } : {})}
      />
    )
  }

  const record = endpoint.data
  const messageFailure = toWebhookFailure(messages.error, 'message attempts')
  const rows = messages.data ?? []

  // Each write rejects with a readable Error for the composition to show.
  const attempt =
    <T,>(run: () => Promise<T>, fallback: string) =>
    async () => {
      try {
        return await run()
      } catch (error) {
        throw writeError(error, fallback)
      }
    }

  return (
    <>
      <WebhookEndpointDetail
        endpoint={record}
        stats={stats.data?.[record.id] ?? null}
        eventTypes={eventTypes.data ?? []}
        eventTypesLoading={eventTypes.isPending}
        tab={tab}
        onTabChange={onTabChange}
        onBack={onBack}
        onUpdate={(patch) =>
          attempt(
            () => update.mutateAsync({ endpoint: record, patch }),
            'The endpoint could not be saved.',
          )()
        }
        onDelete={attempt(async () => {
          await remove.mutateAsync(record.id)
          onBack()
        }, 'The endpoint could not be deleted.')}
        onRecover={(since) =>
          attempt(
            () => recover.mutateAsync({ endpointId: record.id, since }),
            'Recovery could not be started.',
          )()
        }
        onSendExample={(eventType) =>
          attempt(async () => {
            await sendExample.mutateAsync({ endpointId: record.id, eventType })
            void messages.refetch()
          }, 'The example could not be sent.')()
        }
        secret={{
          revealed,
          onRevealedChange: setRevealed,
          value: secret.data ?? null,
          isLoading: secret.isFetching,
          onRotate: attempt(async () => {
            await rotate.mutateAsync(record.id)
            if (revealed) void secret.refetch()
          }, 'The secret could not be rotated.'),
        }}
        headers={headers.data ?? []}
        headersLoading={headers.isPending}
        onSetHeader={(name, value) =>
          attempt(
            () => patchHeaders.mutateAsync({ endpointId: record.id, set: { name, value } }),
            'The header could not be saved.',
          )()
        }
        onRemoveHeader={(name) =>
          attempt(
            () => patchHeaders.mutateAsync({ endpointId: record.id, remove: name }),
            'The header could not be removed.',
          )()
        }
        attempts={
          <WebhookAttemptList
            messages={rows}
            status={status}
            onStatusChange={setStatus}
            isLoading={messages.isPending}
            error={messageFailure?.message ?? null}
            {...(messageFailure?.canRetry ? { onRetry: () => void messages.refetch() } : {})}
            onRefresh={() => void messages.refetch()}
            onOpen={(message) => onMessageChange(message.id)}
            onResend={(message) =>
              resend.mutate(
                { messageId: message.id, endpointId: record.id },
                {
                  onSuccess: () => toast.success('Message resent'),
                  onError: (failure) => toast.error(failure.message),
                },
              )
            }
          />
        }
      />
      <WebhookMessagePanel
        environmentId={environmentId}
        messageId={messageId ?? null}
        known={rows.find((row) => row.id === messageId)}
        endpointId={record.id}
        onClose={() => onMessageChange(undefined)}
      />
    </>
  )
}

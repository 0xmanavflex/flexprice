import type { WebhookMessage } from '@fp/domain'
import { useResendWebhookMessage, useWebhookMessage, useWebhookMessageAttempts } from '@fp/query'
import { WebhookMessageSheet, toast } from '@fp/ui/pages'
import { toWebhookFailure } from './webhookFailure'

/**
 * The message sheet, wired: the message (from the list that opened it, or
 * fetched when the sheet was opened from a link), its attempts, and resend.
 * Opened from an endpoint, the attempts are that endpoint's only.
 */
export function WebhookMessagePanel({
  environmentId,
  messageId,
  known,
  endpointId,
  onClose,
}: {
  environmentId: string
  messageId: string | null
  /** The message as the opening list already has it, to skip a fetch. */
  known?: WebhookMessage | undefined
  endpointId?: string | undefined
  onClose: () => void
}) {
  const fetched = useWebhookMessage(environmentId, known ? null : messageId)
  const attempts = useWebhookMessageAttempts(environmentId, messageId, { endpointId })
  const resend = useResendWebhookMessage(environmentId)

  const message = messageId ? (known ?? fetched.data ?? null) : null

  return (
    <WebhookMessageSheet
      message={message}
      // Opened from a link, the sheet shows at once and says it is loading, or why it failed.
      open={messageId !== null}
      messageLoading={!known && fetched.isPending}
      messageError={known ? null : (toWebhookFailure(fetched.error, 'message')?.message ?? null)}
      onRetry={() => void fetched.refetch()}
      retrying={!known && fetched.isFetching}
      attempts={attempts.data ?? []}
      attemptsLoading={attempts.isPending}
      attemptsError={toWebhookFailure(attempts.error, 'delivery attempts')?.message ?? null}
      onClose={onClose}
      onResend={async (attempt) => {
        try {
          await resend.mutateAsync({ messageId: attempt.messageId, endpointId: attempt.endpointId })
          toast.success('Message resent')
          void attempts.refetch()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'The message could not be resent.')
        }
      }}
    />
  )
}

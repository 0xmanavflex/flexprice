import type { ReactNode } from 'react'
import { WebhookIcon } from '@fp/ui/icons'
import { useWebhookPortal } from '@fp/query'
import { AppFailure, EmptyState, LoadingRows, PageBody } from '@fp/ui/compositions'
import { useSession } from '@/app/session'
import { toWebhookFailure } from './webhookFailure'

/**
 * Every webhook screen opens through here.
 *
 * `GET /webhooks/dashboard` decides whether there is a portal at all: a
 * deployment without Svix answers `svix_enabled: false`, and that is a state to
 * explain, not an error and not an empty list. Until it answers there is no
 * token to call Svix with, so nothing below renders.
 */
export function WebhookPortalGate({
  children,
}: {
  children: (environmentId: string) => ReactNode
}) {
  const { environmentId } = useSession()
  const portal = useWebhookPortal(environmentId)
  const failure = toWebhookFailure(portal.error, 'your webhook settings')

  if (failure) {
    return (
      <AppFailure
        title="Webhooks could not be loaded"
        detail={failure.message}
        {...(failure.canRetry ? { onRetry: () => void portal.refetch() } : {})}
      />
    )
  }

  // The query waits for an environment, so "no id yet" reads as loading too.
  if (!environmentId || portal.isPending || !portal.data) {
    return (
      <PageBody>
        <LoadingRows rows={5} columns={4} />
      </PageBody>
    )
  }

  if (!portal.data.enabled) {
    return (
      <PageBody>
        <EmptyState
          icon={<WebhookIcon aria-hidden />}
          title="Webhooks are not enabled here"
          description="This deployment has no Svix integration configured, so there are no endpoints to manage and no events to deliver. Ask whoever runs it to enable webhooks."
          secondaryAction={
            <a
              className="text-sm underline underline-offset-4"
              href="https://docs.flexprice.io/docs/webhooks/overview"
              target="_blank"
              rel="noreferrer"
            >
              How webhooks work
            </a>
          }
        />
      </PageBody>
    )
  }

  return <>{children(environmentId)}</>
}

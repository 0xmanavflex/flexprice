import type { ReactNode } from 'react'
import { useWebhookPortal } from '@fp/query'
import {
  EMPTY_CATALOGUE,
  EmptyState,
  ErrorState,
  PageBody,
  PageLoadingState,
} from '@fp/ui/compositions'
import { useSession } from '@/app/session'
import { toWebhookFailure } from './webhookFailure'
import { DOCS } from '@fp/domain'

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
      <PageBody>
        <ErrorState
          variant="page"
          title="Webhooks could not be loaded"
          description={failure.message}
          kind={failure.kind}
          isRetrying={portal.isFetching}
          {...(failure.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {})}
          {...(failure.canRetry ? { onRetry: () => void portal.refetch() } : {})}
        />
      </PageBody>
    )
  }

  // The query waits for an environment. A disabled query is `isPending` for
  // ever, so "no environment yet" is a setup state, not a skeleton that never
  // resolves.
  if (!environmentId) {
    return (
      <PageBody>
        <EmptyState
          size="page"
          figure={EMPTY_CATALOGUE.setup.figure}
          motion={EMPTY_CATALOGUE.setup.motion}
          title={EMPTY_CATALOGUE.setup.title}
          description="Choose an environment to manage its webhook endpoints."
        />
      </PageBody>
    )
  }

  if (portal.isLoading || (portal.isPending && portal.fetchStatus !== 'idle')) {
    return <PageLoadingState variant="list" label="Loading webhooks" />
  }

  if (!portal.data) {
    return (
      <PageBody>
        <EmptyState
          size="page"
          figure={EMPTY_CATALOGUE.unavailable.figure}
          motion={EMPTY_CATALOGUE.unavailable.motion}
          title="Webhooks are not available"
          description="The webhook portal did not answer with any settings, so there is nothing to show."
        />
      </PageBody>
    )
  }

  if (!portal.data.enabled) {
    return (
      <PageBody>
        <EmptyState
          title="Webhooks are not enabled here"
          description="This deployment has no Svix integration configured, so there are no endpoints to manage and no events to deliver. Ask whoever runs it to enable webhooks."
          secondaryAction={
            <a
              className="text-sm underline underline-offset-4"
              href={DOCS.webhooks}
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

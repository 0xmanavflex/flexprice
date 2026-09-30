import { ApiError, useIntegrations } from '@fp/query'
import { IntegrationGrid } from '@fp/ui/flexprice'
import { PageBody } from '@fp/ui/compositions'

/** The wiring layer: fetch, turn an error into a sentence, hand the grid plain props. */
export function IntegrationListPage() {
  const integrations = useIntegrations()
  const failure = toFailure(integrations.error)

  return (
    <PageBody>
      <IntegrationGrid
        integrations={integrations.data ?? []}
        isLoading={integrations.isPending}
        error={failure?.message ?? null}
        {...(failure?.canRetry ? { onRetry: () => void integrations.refetch() } : {})}
      />
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to integrations here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading integrations.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading integrations.', canRetry: true }
}

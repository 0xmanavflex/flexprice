import { useIntegrations } from '@fp/query'
import { IntegrationsBlock } from '@fp/ui/pages'
import { toListFailure } from '@/pages/shared/listFailure'

export function IntegrationListPage() {
  const integrations = useIntegrations()
  const failure = toListFailure(integrations.error, 'integrations')

  return (
    <IntegrationsBlock
      integrations={integrations.data ?? []}
      // `isLoading`, not `isPending`: the request is in flight, not merely unanswered.
      isLoading={integrations.isLoading}
      error={failure}
      onRetry={() => void integrations.refetch()}
      isRetrying={integrations.isRefetching}
    />
  )
}

import { useBillingEntityMode, useConnections } from '@fp/query'
import { IntegrationsBlock } from '@fp/ui/pages'
import { toListFailure } from '@/pages/shared/listFailure'
import { useIntegrationSheets } from './useIntegrationSheets'

export function IntegrationListPage({
  onOpenProvider,
}: {
  onOpenProvider: (integrationId: string) => void
}) {
  const integrations = useConnections()
  const failure = toListFailure(integrations.error, 'integrations')
  const { mode, entities } = useBillingEntityMode()
  const { openConnect, openManage, sheets } = useIntegrationSheets(
    integrations.data ?? [],
    entities,
  )

  return (
    <>
      <IntegrationsBlock
        integrations={mode === 'loading' ? [] : (integrations.data ?? [])}
        // `isLoading`, not `isPending`: the request is in flight, not merely unanswered.
        isLoading={integrations.isLoading || mode === 'loading'}
        error={failure}
        onRetry={() => void integrations.refetch()}
        isRetrying={integrations.isRefetching}
        entities={entities}
        onConnect={(integration) => openConnect(integration.id)}
        onConfigure={(integration) => {
          const first = integration.connections[0]
          if (entities) onOpenProvider(integration.id)
          else if (first) openManage(integration.id, first.id)
        }}
      />
      {sheets}
    </>
  )
}

import { BillingEntityMode } from '@fp/domain'
import { useBillingEntities, useBillingEntityStatus, useConnections } from '@fp/query'
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
  const status = useBillingEntityStatus()
  const entities = useBillingEntities()
  const enabled = status.data === BillingEntityMode.Enabled && entities.data !== undefined
  const { openConnect, openManage, sheets } = useIntegrationSheets(integrations.data ?? [])

  return (
    <>
      <IntegrationsBlock
        integrations={integrations.data ?? []}
        // `isLoading`, not `isPending`: the request is in flight, not merely unanswered.
        isLoading={integrations.isLoading}
        error={failure}
        onRetry={() => void integrations.refetch()}
        isRetrying={integrations.isRefetching}
        entities={enabled ? entities.data : undefined}
        onConnect={(integration) => openConnect(integration.id)}
        onConfigure={(integration) => {
          const first = integration.connections[0]
          if (enabled) onOpenProvider(integration.id)
          else if (first) openManage(integration.id, first.id)
        }}
      />
      {sheets}
    </>
  )
}

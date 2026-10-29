import { Navigate } from '@tanstack/react-router'
import { useBillingEntityMode, useConnections } from '@fp/query'
import { ErrorState, PageLoadingState } from '@fp/ui/compositions'
import { IntegrationLogo, ProviderConnections } from '@fp/ui/pages'
import { toListFailure } from '@/pages/shared/listFailure'
import { useIntegrationSheets } from './useIntegrationSheets'

/** One provider's connections by billing entity. Only reachable while entities are enabled. */
export function ProviderConnectionsPage({
  providerId,
  onBack,
}: {
  providerId: string
  onBack: () => void
}) {
  const integrations = useConnections()
  const entityMode = useBillingEntityMode()
  const { openConnect, openManage, sheets } = useIntegrationSheets(
    integrations.data ?? [],
    entityMode.entities,
  )

  if (entityMode.mode === 'off') return <Navigate to="/integrations" replace />
  if (integrations.isPending || entityMode.mode === 'loading') {
    return <PageLoadingState variant="detail" label="Loading integration" />
  }
  const integration = integrations.data?.find((item) => item.id === providerId)
  if (!integration || entityMode.mode === 'error') {
    const failure = toListFailure(integrations.error ?? entityMode.error, 'this integration')
    return (
      <ErrorState
        variant="page"
        title={failure ? 'This integration could not be loaded' : 'This integration does not exist'}
        {...(failure ? { description: failure.message, kind: failure.kind } : {})}
        {...(failure?.canRetry
          ? {
              onRetry: () => {
                void integrations.refetch()
                entityMode.refetch()
              },
            }
          : {})}
      />
    )
  }

  return (
    <>
      <ProviderConnections
        integration={integration}
        logo={<IntegrationLogo integration={integration} />}
        entities={entityMode.entities}
        onBack={onBack}
        onConfigure={(connection) => openManage(integration.id, connection.id)}
        onConnect={(entity) => openConnect(integration.id, entity.id)}
      />
      {sheets}
    </>
  )
}

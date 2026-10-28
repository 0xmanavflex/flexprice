import { BillingEntityMode } from '@fp/domain'
import { useBillingEntities, useBillingEntityStatus, useConnections } from '@fp/query'
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
  const status = useBillingEntityStatus()
  const entities = useBillingEntities()
  const { openConnect, openManage, sheets } = useIntegrationSheets(integrations.data ?? [])

  const off = status.data !== undefined && status.data !== BillingEntityMode.Enabled
  if (integrations.isPending || status.isPending || (!off && entities.isPending)) {
    return <PageLoadingState variant="detail" label="Loading integration" />
  }
  const integration = integrations.data?.find((item) => item.id === providerId)
  if (!integration || off || !entities.data) {
    const failure = toListFailure(integrations.error ?? entities.error, 'this integration')
    return (
      <ErrorState
        variant="page"
        title={failure ? 'This integration could not be loaded' : 'This integration does not exist'}
        {...(failure ? { description: failure.message, kind: failure.kind } : {})}
        {...(failure?.canRetry
          ? { onRetry: () => void Promise.all([integrations.refetch(), entities.refetch()]) }
          : {})}
      />
    )
  }

  return (
    <>
      <ProviderConnections
        integration={integration}
        logo={<IntegrationLogo integration={integration} />}
        entities={entities.data}
        onBack={onBack}
        onConfigure={(connection) => openManage(integration.id, connection.id)}
        onConnect={() => openConnect(integration.id)}
      />
      {sheets}
    </>
  )
}

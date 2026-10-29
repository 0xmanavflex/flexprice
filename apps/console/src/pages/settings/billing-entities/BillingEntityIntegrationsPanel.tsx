import { useBillingEntities, useConnections } from '@fp/query'
import { BillingEntityIntegrations } from '@fp/ui/pages'
import { useIntegrationSheets } from '@/pages/integrations/useIntegrationSheets'

/** A billing entity's integrations; Connect opens the connect sheet with this entity chosen. */
export function BillingEntityIntegrationsPanel({ entityId }: { entityId: string }) {
  const integrations = useConnections()
  const entities = useBillingEntities()
  const { openConnect, sheets } = useIntegrationSheets(integrations.data ?? [], entities.data)

  return (
    <>
      <BillingEntityIntegrations
        entity={{ id: entityId }}
        entities={entities.data ?? []}
        integrations={integrations.data ?? []}
        isLoading={integrations.isPending || entities.isPending}
        failed={integrations.isError || entities.isError}
        onRetry={() => void Promise.all([integrations.refetch(), entities.refetch()])}
        onConnect={(integration) => openConnect(integration.id, entityId)}
      />
      {sheets}
    </>
  )
}

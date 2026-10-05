import { useIntegrations } from '@fp/query'
import { IntegrationsBlock } from '@fp/ui/pages'

export function IntegrationListPage() {
  const integrations = useIntegrations()

  return <IntegrationsBlock integrations={integrations.data ?? []} />
}

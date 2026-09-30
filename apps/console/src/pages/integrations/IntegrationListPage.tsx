import { useIntegrations } from '@fp/query'
import { IntegrationsBlock } from '@fp/ui/pages'
import { PageBody } from '@fp/ui/compositions'

export function IntegrationListPage() {
  const integrations = useIntegrations()

  return (
    <PageBody>
      <IntegrationsBlock integrations={integrations.data ?? []} />
    </PageBody>
  )
}

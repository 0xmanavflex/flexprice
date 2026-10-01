import { PageBody } from '@fp/ui/compositions'
import { ApiKeysPanel } from './ApiKeysPanel'
import { ServiceAccountsPanel } from './ServiceAccountsPanel'
import { WebhooksPanel } from './WebhooksPanel'

/** One of the three Developers panels on a page of its own. */
export function DeveloperPanels({
  panel,
}: {
  panel: 'api-keys' | 'service-accounts' | 'webhooks'
}) {
  return (
    <PageBody>
      {panel === 'api-keys' ? (
        <ApiKeysPanel />
      ) : panel === 'service-accounts' ? (
        <ServiceAccountsPanel />
      ) : (
        <WebhooksPanel />
      )}
    </PageBody>
  )
}

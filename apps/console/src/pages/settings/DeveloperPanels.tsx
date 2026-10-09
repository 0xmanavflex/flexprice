import { PageBody } from '@fp/ui/compositions'
import { ApiKeysPanel } from './ApiKeysPanel'
import { ServiceAccountsPanel } from './ServiceAccountsPanel'

/** One of the Developers panels on a page of its own. Webhooks has its own pages (`pages/webhooks`). */
export function DeveloperPanels({ panel }: { panel: 'api-keys' | 'service-accounts' }) {
  return <PageBody>{panel === 'api-keys' ? <ApiKeysPanel /> : <ServiceAccountsPanel />}</PageBody>
}

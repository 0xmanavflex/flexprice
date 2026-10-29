import { effectiveEntityId, type BillingEntity, type Integration } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { AppFailure, LoadingRows } from '../../../compositions'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { IntegrationLogo } from '../../integrations/IntegrationsBlock'

/**
 * A billing entity's Integrations tab: one Section per category, a row per
 * provider with the connection this entity owns. Connect starts one for the
 * entity; the connections themselves are managed on the Integrations page.
 */
export const BillingEntityIntegrationsProvenance = provenance({
  source: 'composition',
  composes: ['compositions/layout/Section', 'compositions/detail-kit'],
  note: 'Entity integrations: a Section table per catalogue category, Connect per unconnected provider.',
})

export interface BillingEntityIntegrationsProps {
  entity: Pick<BillingEntity, 'id'>
  /** The environment's billing entities, so a connection without one counts as the default's. */
  entities: readonly Pick<BillingEntity, 'id' | 'isDefault'>[]
  integrations: Integration[]
  isLoading: boolean
  failed: boolean
  onRetry: () => void
  onConnect: (integration: Integration) => void
}

export function BillingEntityIntegrations({
  entity,
  entities,
  integrations,
  isLoading,
  failed,
  onRetry,
  onConnect,
}: BillingEntityIntegrationsProps) {
  if (isLoading || failed) {
    return (
      <Section table showTitle title="Integrations">
        <div className="p-6">
          {isLoading ? (
            <LoadingRows />
          ) : (
            <AppFailure
              title="Integrations could not be loaded"
              detail="The rest of this entity's record still works."
              onRetry={onRetry}
            />
          )}
        </div>
      </Section>
    )
  }

  const rows = integrations
    .filter((integration) => !integration.premium)
    .map((integration) => ({
      integration,
      connection:
        integration.connections.find(
          (connection) => effectiveEntityId(connection, entities) === entity.id,
        ) ?? null,
    }))
  const categories = [...new Set(rows.map((row) => row.integration.categories[0] ?? 'Other'))]

  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
        <Section key={category} table showTitle title={category}>
          <SimpleTable
            columns={[
              {
                key: 'provider',
                header: 'Provider',
                cell: ({ integration }) => (
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-5 items-center justify-center">
                      <IntegrationLogo integration={integration} />
                    </span>
                    <span className="font-medium">{integration.name}</span>
                  </span>
                ),
              },
              {
                key: 'connection',
                header: 'Connection',
                cell: ({ connection }) => connection?.name ?? '—',
              },
              {
                key: 'action',
                header: '',
                className: 'w-32 text-right',
                cell: ({ integration, connection }) =>
                  connection ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      aria-label={`Connect ${integration.name}`}
                      onClick={() => onConnect(integration)}
                    >
                      Connect
                    </Button>
                  ),
              },
            ]}
            rows={rows.filter((row) => (row.integration.categories[0] ?? 'Other') === category)}
            getRowId={({ integration }) => integration.id}
          />
        </Section>
      ))}
    </div>
  )
}

import type { ReactNode } from 'react'
import {
  connectionForEntity,
  webhookMissing,
  type Integration,
  type IntegrationConnection,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { SimpleTable } from '@ui/compositions/detail/DetailKit'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { EntityHeader } from '../shared/EntityHeader'
import { Pill } from '../shared/cells'
import type { ListBillingEntity } from '../shared/billingEntityColumn'

/**
 * One provider's connections across the environment's billing entities: a row
 * per entity with the connection that entity owns, or none. Configure opens
 * that connection; Connect starts one for the provider.
 */
export const ProviderConnectionsProvenance = provenance({
  source: 'composition',
  composes: ['pages/shared/EntityHeader', 'compositions/detail-kit', 'compositions/layout/Section'],
  note: 'Provider page: EntityHeader over a Section table with one row per billing entity.',
})

export interface ProviderConnectionsProps {
  integration: Integration
  logo: ReactNode
  entities: readonly ListBillingEntity[]
  onBack: () => void
  onConfigure: (connection: IntegrationConnection) => void
  onConnect: (entity: ListBillingEntity) => void
}

export function ProviderConnections({
  integration,
  logo,
  entities,
  onBack,
  onConfigure,
  onConnect,
}: ProviderConnectionsProps) {
  const rows = entities.map((entity) => ({
    entity,
    connection: connectionForEntity(integration, entity.id, entities),
  }))
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: 'Integrations', onClick: onBack }, { label: integration.name }]}
        icon={<span className="flex size-5 items-center justify-center">{logo}</span>}
        title={integration.name}
      />
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] min-w-0 flex-col gap-6 px-6 pb-10">
        <Section
          table
          title="Billing entities"
          description={`The ${integration.name} account each billing entity uses.`}
        >
          <SimpleTable
            columns={[
              {
                key: 'entity',
                header: 'Billing entity',
                cell: ({ entity }) => (
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{entity.name}</span>
                    {entity.isDefault ? <Pill size="sm">Default</Pill> : null}
                  </span>
                ),
              },
              {
                key: 'connection',
                header: 'Connection',
                cell: ({ connection }) =>
                  connection ? (
                    <span className="flex items-center gap-2">
                      <span>{connection.name}</span>
                      {webhookMissing(connection) ? (
                        <Pill tone="warning" size="sm">
                          Webhook not set up
                        </Pill>
                      ) : null}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'action',
                header: '',
                className: 'w-32 text-right',
                cell: ({ entity, connection }) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    aria-label={`${connection ? 'Configure' : 'Connect'} ${connection?.name ?? entity.name}`}
                    onClick={() => (connection ? onConfigure(connection) : onConnect(entity))}
                  >
                    {connection ? 'Configure' : 'Connect'}
                  </Button>
                ),
              },
            ]}
            rows={rows}
            getRowId={({ entity }) => entity.id}
          />
        </Section>
      </div>
    </div>
  )
}

import type { IntegrationLink } from '@fp/domain'
import { Skeleton } from '@ui/components/primitives/skeleton'
import { IntegrationChips } from '../customers/IntegrationMark'
import { EmDash, type EntityColumn } from './cells'

export type IntegrationMappings = ReadonlyMap<
  string,
  {
    links: IntegrationLink[] | undefined
    state: 'ready' | 'loading' | 'error'
    retry: () => void
  }
>

export function integrationColumn<T extends { id: string }>(
  mappings: IntegrationMappings | undefined,
  entityLabel: string,
  header = 'Integrations',
): EntityColumn<T> {
  return {
    id: 'integrations',
    header,
    width: 130,
    text: (row) =>
      (mappings?.get(row.id)?.links ?? [])
        .map((link) => `${link.name} (${link.providerEntityId})`)
        .join(', '),
    cell: (row) => {
      const mapping = mappings?.get(row.id)
      if (mapping?.state === 'loading')
        return <Skeleton aria-label="Loading integrations" className="h-6 w-12" />
      if (mapping?.state === 'error')
        return (
          <button
            type="button"
            className="text-muted-foreground text-xs underline"
            onClick={(event) => {
              event.stopPropagation()
              mapping.retry()
            }}
          >
            Retry integrations
          </button>
        )
      return mapping?.links?.length ? (
        <IntegrationChips integrations={mapping.links} entityLabel={entityLabel} />
      ) : (
        <EmDash />
      )
    },
  }
}

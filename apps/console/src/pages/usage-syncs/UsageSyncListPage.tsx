import { useState } from 'react'
import { WaypointsIcon } from 'lucide-react'
import { type UsageSync, type UsageSyncQuery } from '@fp/domain'
import { ApiError, useUsageSyncs } from '@fp/query'
import { UsageSyncDetailSheet, UsageSyncGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'

export interface UsageSyncListPageProps {
  query: UsageSyncQuery
  onQueryChange: (query: UsageSyncQuery) => void
}

/**
 * The wiring layer: fetch, turn an error into a sentence, hand the grid plain
 * props. The query lives in the URL; the opened record is ephemeral.
 */
export function UsageSyncListPage({ query, onQueryChange }: UsageSyncListPageProps) {
  const usageSyncs = useUsageSyncs(query)
  const [selected, setSelected] = useState<UsageSync | null>(null)

  const rows = usageSyncs.data?.usageSyncs ?? []
  const isFiltered = query.search.length > 0 || query.state !== 'all'
  const clearFilters = () => onQueryChange({ ...query, search: '', state: 'all', page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={usageSyncs.isPending}
        error={toFailure(usageSyncs.error)}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void usageSyncs.refetch()}
        onClearFilters={clearFilters}
        emptyIcon={<WaypointsIcon aria-hidden />}
        emptyTitle="No usage has been recorded yet"
        emptyDescription="Usage that bills through a cloud marketplace is recorded per billing period, and where it was reported shows here."
      >
        <UsageSyncGrid
          usageSyncs={rows}
          total={usageSyncs.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onRefresh={() => void usageSyncs.refetch()}
          onUsageSyncClick={setSelected}
          onClearFilters={clearFilters}
        />
      </ListState>
      <UsageSyncDetailSheet usageSync={selected} onClose={() => setSelected(null)} />
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to usage syncs here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading usage syncs.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading usage syncs.', canRetry: true }
}

import { useState } from 'react'
import { type UsageSync, type UsageSyncQuery } from '@fp/domain'
import { useUsageSyncs } from '@fp/query'
import { UsageSyncDetailSheet, UsageSyncGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { toListFailure } from '../shared/listFailure'

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
  const failure = toListFailure(usageSyncs.error, 'usage syncs')
  const [selected, setSelected] = useState<UsageSync | null>(null)

  const rows = usageSyncs.data?.usageSyncs ?? []
  const isFiltered = query.search.length > 0 || query.state !== 'all'
  const clearFilters = () => onQueryChange({ ...query, search: '', state: 'all', page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={usageSyncs.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (usageSyncs.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={usageSyncs.isFetching && !usageSyncs.isPending}
        isProvisional={usageSyncs.isPlaceholderData}
        isRetrying={usageSyncs.isFetching && usageSyncs.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        isFiltered={isFiltered}
        onRetry={() => void usageSyncs.refetch()}
        onClearFilters={clearFilters}
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

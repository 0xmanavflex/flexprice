import { type Addon, type AddonQuery } from '@fp/domain'
import { useAddons } from '@fp/query'
import { AddonGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface AddonListPageProps {
  query: AddonQuery
  onQueryChange: (query: AddonQuery) => void
  onOpenAddon: (addon: Addon) => void
  onCreateAddon: () => void
  onEditAddon: (addon: Addon) => void
}

/**
 * The add-on surface: a list. Create and edit are full pages (`AddonFormPage`);
 * names rename inline in the row.
 *
 * The list stays URL-driven — a filtered view is a link.
 */
export function AddonListPage({
  query,
  onQueryChange,
  onOpenAddon,
  onCreateAddon,
  onEditAddon,
}: AddonListPageProps) {
  const addons = useAddons(query)
  const failure = toListFailure(addons.error, 'add-ons')
  const rows = addons.data?.addons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={addons.isPending}
        error={failure}
        isEmpty={rows.length === 0 && (addons.data?.total ?? 0) === 0 && !isFiltered}
        hasRows={rows.length > 0}
        isRefreshing={addons.isFetching && !addons.isPending}
        isProvisional={addons.isPlaceholderData}
        isRetrying={addons.isFetching && addons.isError}
        {...(failure ? { failureKind: failure.kind } : {})}
        isFiltered={isFiltered}
        onRetry={() => void addons.refetch()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={onCreateAddon}>New add-on</Button>}
        emptyTitle="No add-ons yet"
        emptyDescription="Add-ons are optional extras customers buy alongside a plan — extra seats, priority support. Create the first to offer one."
      >
        <AddonGrid
          addons={rows}
          total={addons.data?.total ?? 0}
          query={query}
          onQueryChange={onQueryChange}
          onAddonClick={onOpenAddon}
          onCreate={onCreateAddon}
          onEdit={onEditAddon}
          onClearFilters={clearFilters}
        />
      </ListState>
    </PageBody>
  )
}

import { type Addon, type AddonQuery } from '@fp/domain'
import { ApiError, useAddons, useCatalogStats } from '@fp/query'
import { AddonGrid } from '@fp/ui/pages'
import { ListState, PageBody } from '@fp/ui/compositions'
import { PuzzleIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

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
  // The server's counts for the status dropdown — one `limit: 1` request each,
  // read for `pagination.total`, never counted off the page on screen.
  const stats = useCatalogStats('addons')

  const failure = toFailure(addons.error)
  const rows = addons.data?.addons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <PageBody>
      <ListState
        isLoading={addons.isPending}
        error={failure}
        isEmpty={rows.length === 0 && !isFiltered}
        isFiltered={isFiltered}
        onRetry={() => void addons.refetch()}
        onClearFilters={clearFilters}
        createAction={<Button onClick={onCreateAddon}>New add-on</Button>}
        emptyIcon={<PuzzleIcon aria-hidden />}
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
          statusCounts={{
            total: stats.total,
            published: stats.published,
            archived: stats.archived,
          }}
        />
      </ListState>
    </PageBody>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to add-ons here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading add-ons.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading add-ons.', canRetry: true }
}

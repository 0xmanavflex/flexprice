import { type Addon, type AddonQuery } from '@fp/domain'
import { ApiError, useAddons } from '@fp/query'
import { AddonFilters, AddonGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { PuzzleIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface AddonListPageProps {
  query: AddonQuery
  onQueryChange: (query: AddonQuery) => void
  onCreate: () => void
  onOpenAddon: (addon: Addon) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `PlanListPage`.
 *
 * Replaces V1's `Addons.tsx`. Fetches, turns an error into a sentence, and hands
 * the grid plain props. No `useState`: the query lives in the URL.
 */
export function AddonListPage({ query, onQueryChange, onCreate, onOpenAddon }: AddonListPageProps) {
  const addons = useAddons(query)

  const failure = toFailure(addons.error)
  const rows = addons.data?.addons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  return (
    <>
      <PageHeader
        title="Add-ons"
        description="Extras a customer can buy alongside a plan."
        action={<Button onClick={onCreate}>New add-on</Button>}
      />

      <PageBody>
        <ListState
          isLoading={addons.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void addons.refetch()}
          onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
          createAction={<Button onClick={onCreate}>New add-on</Button>}
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
            onClearFilters={() => onQueryChange({ ...query, search: '', statuses: [], page: 1 })}
            filters={
              <AddonFilters
                statuses={query.statuses}
                onStatusesChange={(statuses) => onQueryChange({ ...query, statuses, page: 1 })}
              />
            }
          />
        </ListState>
      </PageBody>
    </>
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

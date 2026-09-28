import { type Group, type GroupQuery } from '@fp/domain'
import { ApiError, useGroups } from '@fp/query'
import { GroupFilters, GroupGrid } from '@fp/ui/flexprice'
import { ListState, PageBody, PageHeader } from '@fp/ui/compositions'
import { LayersIcon } from 'lucide-react'

export interface GroupListPageProps {
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  onOpenGroup: (group: Group) => void
}

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — creating and
 * editing a group is a later surface, the same way coupons shipped a list
 * before its editor.
 */
export function GroupListPage({ query, onQueryChange, onOpenGroup }: GroupListPageProps) {
  const groups = useGroups(query)

  const failure = toFailure(groups.error)
  const rows = groups.data?.groups ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageHeader
        title="Groups"
        description="Collections of prices or features, managed and reported together."
      />

      <PageBody>
        <ListState
          isLoading={groups.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void groups.refetch()}
          onClearFilters={clearFilters}
          emptyIcon={<LayersIcon aria-hidden />}
          emptyTitle="No groups yet"
          emptyDescription="Groups bundle prices or features so they report and invoice together — a product line, a region. They appear here once created."
        >
          <GroupGrid
            groups={rows}
            total={groups.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onGroupClick={onOpenGroup}
            onClearFilters={clearFilters}
            filters={
              <GroupFilters
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
        return { message: 'You do not have access to groups here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading groups.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading groups.', canRetry: true }
}

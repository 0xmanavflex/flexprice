import { type Group, type GroupQuery } from '@fp/domain'
import { ApiError, useGroups } from '@fp/query'
import { GroupFilters, GroupGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { LayersIcon } from 'lucide-react'
import { env } from '@/env'

export interface GroupListPageProps {
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  onOpenGroup: (group: Group) => void
}

/** Where a group is created today. Unset origin means no link is offered. */
const LEGACY_PATH = '/product-catalog/groups'

/**
 * The wiring layer, and nothing else — the same shape as `CouponListPage`.
 *
 * Fetches, turns an error into a sentence, and hands the grid plain props. No
 * `useState`: the query lives in the URL. Read-only for now — creating and
 * editing a group is a later surface, the same way coupons shipped a list
 * before its editor.
 *
 * Which is exactly why the create action is a hand-off rather than nothing.
 * This page replaced a placeholder that offered "Create group" against the
 * current dashboard, and shipping the real list dropped that link without
 * putting anything in its place: a tenant with no groups had no route to a
 * first one from anywhere in the console. Until `POST /groups` is wired to a
 * drawer here, the offer goes where the thing can actually be made today —
 * the same reasoning, and the same link, as `PlaceholderPage`.
 */
export function GroupListPage({ query, onQueryChange, onOpenGroup }: GroupListPageProps) {
  const groups = useGroups(query)

  const createHref = env.legacyConsoleUrl ? `${env.legacyConsoleUrl}${LEGACY_PATH}` : null

  const failure = toFailure(groups.error)
  const rows = groups.data?.groups ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        <ListState
          isLoading={groups.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void groups.refetch()}
          onClearFilters={clearFilters}
          {...(createHref
            ? {
                createAction: (
                  <Button
                    size="sm"
                    render={
                      // A new tab: following a link out of the console should
                      // not discard what is open in it.
                      <a href={createHref} rel="noreferrer" target="_blank" />
                    }
                  >
                    New group
                  </Button>
                ),
              }
            : {})}
          emptyIcon={<LayersIcon aria-hidden />}
          emptyTitle="No groups yet"
          emptyDescription={
            createHref
              ? 'Groups bundle prices or features so they report and invoice together — a product line, a region. Create the first in the current dashboard.'
              : 'Groups bundle prices or features so they report and invoice together — a product line, a region. Creating one is not in this console yet — use POST /groups, or the current dashboard.'
          }
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

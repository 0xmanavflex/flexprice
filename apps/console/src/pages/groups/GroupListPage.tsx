import { useState } from 'react'
import { type Group, type GroupQuery } from '@fp/domain'
import { ApiError, useDeleteGroup, useGroups, serverReason } from '@fp/query'
import { GroupGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { toListFailure } from '../shared/listFailure'

export interface GroupListPageProps {
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  onCreateGroup: () => void
}

/**
 * The group surface: a list, a compact full page to create one (`/groups/new`), and a confirmed delete.
 *
 * The API has no group update, so there is no edit and no inline rename: a
 * wrong name means delete and recreate. The list stays URL-driven; the pending
 * delete is the only local state.
 */
export function GroupListPage({ query, onQueryChange, onCreateGroup }: GroupListPageProps) {
  const groups = useGroups(query)
  const remove = useDeleteGroup()

  const [deleting, setDeleting] = useState<Group | null>(null)

  const failure = toListFailure(groups.error, 'groups')
  const rows = groups.data?.groups ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={groups.isPending}
          error={failure}
          isEmpty={rows.length === 0 && (groups.data?.total ?? 0) === 0 && !isFiltered}
          hasRows={rows.length > 0}
          isRefreshing={groups.isFetching && !groups.isPending}
          isProvisional={groups.isPlaceholderData}
          isRetrying={groups.isFetching && groups.isError}
          {...(failure ? { failureKind: failure.kind } : {})}
          isFiltered={isFiltered}
          onRetry={() => void groups.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreateGroup}>New tag</Button>}
          emptyTitle="No tags yet"
          emptyDescription="Tags bundle prices or features so they report and invoice together: a product line, a region. Create the first to start."
        >
          <GroupGrid
            groups={rows}
            total={groups.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onCreate={onCreateGroup}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete ${deleting?.name ?? 'tag'}?`}
        description="The tag is removed; the prices or features in it are not. This cannot be undone."
        confirmLabel="Delete tag"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: closeDelete })
        }}
        isPending={remove.isPending}
        destructive
        error={toSubmitError(remove.error)}
      />
    </>
  )
}

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change tags here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the tag. Try again.'
    }
  }
  return 'Could not save the tag. Try again.'
}

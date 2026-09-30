import { useState } from 'react'
import { type Group, type GroupQuery } from '@fp/domain'
import { ApiError, useCreateGroup, useDeleteGroup, useGroups } from '@fp/query'
import { GroupEditorDialog, GroupGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { LayersIcon } from 'lucide-react'

export interface GroupListPageProps {
  query: GroupQuery
  onQueryChange: (query: GroupQuery) => void
  onOpenGroup: (group: Group) => void
}

/**
 * The group surface: a list, a dialog to create one, and a confirmed delete.
 *
 * The API has no group update, so there is no edit and no inline rename — a
 * wrong name means delete and recreate. The list stays URL-driven; the dialog
 * and the pending delete are the only local state.
 */
export function GroupListPage({ query, onQueryChange, onOpenGroup }: GroupListPageProps) {
  const groups = useGroups(query)
  const create = useCreateGroup()
  const remove = useDeleteGroup()

  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Group | null>(null)

  const failure = toFailure(groups.error)
  const rows = groups.data?.groups ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const closeCreate = () => {
    setCreating(false)
    create.reset()
  }

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
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void groups.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => setCreating(true)}>New group</Button>}
          emptyIcon={<LayersIcon aria-hidden />}
          emptyTitle="No groups yet"
          emptyDescription="Groups bundle prices or features so they report and invoice together — a product line, a region. Create the first to start."
        >
          <GroupGrid
            groups={rows}
            total={groups.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onGroupClick={onOpenGroup}
            onCreate={() => setCreating(true)}
            onDelete={setDeleting}
            onClearFilters={clearFilters}
          />
        </ListState>
      </PageBody>

      <GroupEditorDialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) closeCreate()
        }}
        onSubmit={(draft) => create.mutate(draft, { onSuccess: closeCreate })}
        isSubmitting={create.isPending}
        submitError={toSubmitError(create.error)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title={`Delete ${deleting?.name ?? 'group'}?`}
        description="The group is removed; the prices or features in it are not. This cannot be undone."
        confirmLabel="Delete group"
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

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change groups here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the group. Try again.'
    }
  }
  return 'Could not save the group. Try again.'
}

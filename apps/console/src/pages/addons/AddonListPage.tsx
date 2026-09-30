import { useState } from 'react'
import { type Addon, type AddonQuery, type CreateAddon } from '@fp/domain'
import { ApiError, useAddons, useCatalogStats, useCreateAddon, useUpdateAddon } from '@fp/query'
import { AddonEditorDialog, AddonGrid } from '@fp/ui/flexprice'
import { ListState, PageBody } from '@fp/ui/compositions'
import { PuzzleIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'

export interface AddonListPageProps {
  query: AddonQuery
  onQueryChange: (query: AddonQuery) => void
  onOpenAddon: (addon: Addon) => void
}

/** Which record the drawer is editing — a new one, or an existing add-on. */
type Editing = { mode: 'create' } | { mode: 'edit'; addon: Addon } | null

/**
 * The add-on surface: a list, and a drawer to create or edit one.
 *
 * The list stays URL-driven — a filtered view is a link. The editor is the one
 * piece of local state here, because a half-typed add-on is not a place worth a
 * URL; opening it keeps the list behind it rather than navigating away.
 */
export function AddonListPage({ query, onQueryChange, onOpenAddon }: AddonListPageProps) {
  const addons = useAddons(query)
  // The server's counts for the status dropdown — one `limit: 1` request each,
  // read for `pagination.total`, never counted off the page on screen.
  const stats = useCatalogStats('addons')
  const create = useCreateAddon()
  const update = useUpdateAddon()

  const [editing, setEditing] = useState<Editing>(null)

  const failure = toFailure(addons.error)
  const rows = addons.data?.addons ?? []
  const isFiltered = query.search.length > 0 || query.statuses.length > 0

  const active = editing?.mode === 'create' ? create : update
  const clearFilters = () => onQueryChange({ ...query, search: '', statuses: [], page: 1 })

  const close = () => {
    setEditing(null)
    // Drop a stale submit error so the next open starts clean.
    create.reset()
    update.reset()
  }

  const submit = (draft: CreateAddon) => {
    if (editing?.mode === 'create') {
      create.mutate(draft, { onSuccess: close })
    } else if (editing?.mode === 'edit') {
      update.mutate({ id: editing.addon.id, draft }, { onSuccess: close })
    }
  }

  return (
    <>
      <PageBody>
        <ListState
          isLoading={addons.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void addons.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={() => setEditing({ mode: 'create' })}>New add-on</Button>}
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
            onRename={(addon, name) =>
              update
                .mutateAsync({
                  id: addon.id,
                  draft: { name, lookupKey: addon.lookupKey, description: addon.description },
                })
                .then(() => undefined, () => undefined)
            }
            onCreate={() => setEditing({ mode: 'create' })}
            // The editor sheet this page already owns, reached from the row
            // menu as well as from a row.
            onEdit={(addon) => setEditing({ mode: 'edit', addon })}
            onClearFilters={clearFilters}
            statusCounts={{
              total: stats.total,
              published: stats.published,
              archived: stats.archived,
            }}
          />
        </ListState>
      </PageBody>

      <AddonEditorDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        mode={editing?.mode ?? 'create'}
        {...(editing?.mode === 'edit'
          ? {
              defaultValue: {
                name: editing.addon.name,
                lookupKey: editing.addon.lookupKey,
                description: editing.addon.description,
              },
            }
          : {})}
        onSubmit={submit}
        isSubmitting={active.isPending}
        submitError={toSubmitError(active.error)}
      />
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

/** A save failure, as a sentence the form can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      // 4xx the caller can fix — a duplicate lookup key is the common one, so
      // the server's own message (which names the field) is better than ours.
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change add-ons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the add-on. Try again.'
    }
  }
  return 'Could not save the add-on. Try again.'
}

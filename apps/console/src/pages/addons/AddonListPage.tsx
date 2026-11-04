import { useMemo, useState } from 'react'
import { type Addon, type AddonQuery, isAddonQueryFiltered } from '@fp/domain'
import { useAddonLinkage, useAddons, useDeleteAddon } from '@fp/query'
import { AddonGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
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
 * The list stays URL-driven: a filtered view is a link.
 */
export function AddonListPage({
  query,
  onQueryChange,
  onOpenAddon,
  onCreateAddon,
  onEditAddon,
}: AddonListPageProps) {
  const addons = useAddons(query)
  const archive = useDeleteAddon()
  const [archiving, setArchiving] = useState<Addon | null>(null)
  const failure = toListFailure(addons.error, 'add-ons')
  const rows = useMemo(() => addons.data?.addons ?? [], [addons.data])
  // Entitlement counts for the rows on screen; not on the add-on itself.
  const linked = useAddonLinkage(useMemo(() => rows.map((addon) => addon.id), [rows]))
  const isFiltered = isAddonQueryFiltered(query)

  const clearFilters = () =>
    onQueryChange({ ...query, search: '', statuses: [], filters: [], page: 1 })

  return (
    <>
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
          emptyDescription="Add-ons are optional extras customers buy alongside a plan: extra seats, priority support. Create the first to offer one."
        >
          <AddonGrid
            linkage={linked.byAddon}
            linkageLoading={linked.isPending}
            onArchive={setArchiving}
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

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(null)
            archive.reset()
          }
        }}
        title={`Archive ${archiving?.name ?? 'this add-on'}?`}
        description="The add-on stops being offered. Contracts that already have it keep it."
        confirmLabel="Archive add-on"
        destructive
        isPending={archive.isPending}
        error={archive.isError ? 'Could not archive the add-on. Try again.' : null}
        onConfirm={() => {
          if (archiving) archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })
        }}
      />
    </>
  )
}

import { useState } from 'react'
import { type CloneFeature, type Feature, type FeatureQuery } from '@fp/domain'
import {
  ApiError,
  useCatalogStats,
  useCloneFeature,
  useDeleteFeature,
  useFeatures,
  useUpdateFeature,
} from '@fp/query'
import { FeatureCloneDialog, FeatureGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { GaugeIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'
import { toSubmitError } from './featureMessages'

export interface FeatureListPageProps {
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  onCreateFeature: () => void
  onEditFeature: (feature: Feature) => void
  onOpenFeature: (feature: Feature) => void
}

/**
 * The feature surface: a list. Create and edit are full pages (`FeatureFormPage`);
 * clone and delete are small confirmations that stay here. Names rename inline.
 */
export function FeatureListPage({
  query,
  onQueryChange,
  onCreateFeature,
  onEditFeature,
  onOpenFeature,
}: FeatureListPageProps) {
  const features = useFeatures(query)
  const update = useUpdateFeature()
  const clone = useCloneFeature()
  const remove = useDeleteFeature()

  const [cloning, setCloning] = useState<Feature | null>(null)
  const [deleting, setDeleting] = useState<Feature | null>(null)

  const onCreate = onCreateFeature
  const closeClone = () => {
    setCloning(null)
    clone.reset()
  }
  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const submitClone = (draft: CloneFeature) => {
    if (cloning) clone.mutate({ id: cloning.id, draft }, { onSuccess: closeClone })
  }
  // Counts per status for the toolbar's status dropdown. Each is one
  // `limit: 1` request read for its `pagination.total` — the server's count,
  // not the twenty-five rows that happen to be on screen.
  const stats = useCatalogStats('features')

  const failure = toFailure(features.error)
  const rows = features.data?.features ?? []
  const isFiltered = query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0
  const clearFilters = () =>
    onQueryChange({ ...query, search: '', types: [], statuses: [], page: 1 })

  return (
    <>
      <PageBody>
        {/*
          Every state comes from one place, so this screen cannot invent its
          own. Loading, both empties and both errors are inherited and already
          tested.
        */}
        {/*
          `isEmpty` is only true when the catalogue itself is empty. When a
          filter is responsible, the grid keeps its own toolbar and says "no
          features match these filters" in the table body — replacing the whole
          grid would take the search box away with it, leaving no way to undo
          the search that caused the emptiness.
        */}
        <ListState
          isLoading={features.isPending}
          error={failure}
          isEmpty={rows.length === 0 && !isFiltered}
          isFiltered={isFiltered}
          onRetry={() => void features.refetch()}
          onClearFilters={clearFilters}
          createAction={<Button onClick={onCreate}>New feature</Button>}
          emptyIcon={<GaugeIcon aria-hidden />}
          emptyTitle="Nothing is being measured yet"
          emptyDescription="A Feature is what you meter or gate — API calls, seats, SSO. Plans price them and entitlements limit them, so this is the first thing to create."
        >
          {/*
            No onFeatureClick: the feature detail page is not built yet, and a
            row that navigates nowhere useful — the old behaviour dropped the
            name into the search box — is worse than a row that does nothing.
          */}
          <FeatureGrid
            features={rows}
            total={features.data?.total ?? 0}
            query={query}
            onQueryChange={onQueryChange}
            onFeatureClick={onOpenFeature}
            onCreate={onCreate}
            onEdit={onEditFeature}
            onClone={setCloning}
            onDelete={setDeleting}
            onRename={(feature, name) =>
              update.mutateAsync({ id: feature.id, draft: { name } }).then(
                () => undefined,
                () => undefined,
              )
            }
            onClearFilters={clearFilters}
            statusCounts={{
              total: stats.total,
              published: stats.published,
              archived: stats.archived,
            }}
          />
        </ListState>
      </PageBody>

      <FeatureCloneDialog
        open={cloning !== null}
        onOpenChange={(open) => {
          if (!open) closeClone()
        }}
        source={cloning}
        onSubmit={submitClone}
        isSubmitting={clone.isPending}
        submitError={toSubmitError(clone.error, 'clone')}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title="Delete feature"
        description={`Delete ${deleting?.name ?? 'this feature'}? Plans and entitlements that use it lose it.`}
        confirmLabel="Delete feature"
        destructive
        isPending={remove.isPending}
        error={toSubmitError(remove.error, 'delete')}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: closeDelete })
        }}
      />
    </>
  )
}

/**
 * A failure, as a sentence and a judgement about whether retrying can help.
 *
 * `canRetry` is the important half: a permission error offers no retry, because
 * pressing the button again cannot change the answer.
 */
function toFailure(error: unknown): { message: string; canRetry: boolean } | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return { message: 'You do not have access to features here.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading features.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading features.', canRetry: true }
}

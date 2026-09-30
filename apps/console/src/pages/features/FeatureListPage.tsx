import { useMemo, useState } from 'react'
import {
  type CloneFeature,
  type CreateFeature,
  type EditFeature,
  type Feature,
  type FeatureQuery,
  DEFAULT_GROUP_QUERY,
  GroupEntityType,
} from '@fp/domain'
import {
  ApiError,
  useCatalogStats,
  useCloneFeature,
  useCreateFeature,
  useDeleteFeature,
  useFeatures,
  useGroups,
  useUpdateFeature,
} from '@fp/query'
import { FeatureCloneDialog, FeatureEditorDialog, FeatureGrid } from '@fp/ui/pages'
import { ConfirmDialog, ListState, PageBody } from '@fp/ui/compositions'
import { GaugeIcon } from 'lucide-react'
import { Button } from '@fp/ui/primitives'
import { toSubmitError } from './featureMessages'

export interface FeatureListPageProps {
  query: FeatureQuery
  onQueryChange: (query: FeatureQuery) => void
  /** Opens with the create dialog showing — the `/features/new` entry point. */
  initialCreate?: boolean
  onOpenFeature: (feature: Feature) => void
}

type Editing = { mode: 'create' } | { mode: 'edit'; feature: Feature } | null

/**
 * The feature surface: a list, and dialogs to create, edit, clone and delete.
 *
 * The query lives in the URL. The dialogs are the only local state, because a
 * half-typed feature is not worth a URL; opening one keeps the list behind it.
 */
export function FeatureListPage({
  query,
  onQueryChange,
  initialCreate = false,
  onOpenFeature,
}: FeatureListPageProps) {
  const features = useFeatures(query)
  const create = useCreateFeature()
  const update = useUpdateFeature()
  const clone = useCloneFeature()
  const remove = useDeleteFeature()
  const groups = useGroups({ ...DEFAULT_GROUP_QUERY, pageSize: 100 })

  const [editing, setEditing] = useState<Editing>(initialCreate ? { mode: 'create' } : null)
  const [cloning, setCloning] = useState<Feature | null>(null)
  const [deleting, setDeleting] = useState<Feature | null>(null)

  const groupOptions = useMemo(
    () =>
      (groups.data?.groups ?? [])
        .filter((group) => group.entityType === GroupEntityType.Feature)
        .map((group) => ({ value: group.id, label: group.name })),
    [groups.data],
  )

  const onCreate = () => setEditing({ mode: 'create' })
  const active = editing?.mode === 'edit' ? update : create

  const closeEditor = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }
  const closeClone = () => {
    setCloning(null)
    clone.reset()
  }
  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const submitCreate = (draft: CreateFeature) => create.mutate(draft, { onSuccess: closeEditor })
  const submitEdit = (feature: Feature) => (draft: EditFeature) =>
    update.mutate({ id: feature.id, draft }, { onSuccess: closeEditor })
  const submitClone = (draft: CloneFeature) => {
    if (cloning) clone.mutate({ id: cloning.id, draft }, { onSuccess: closeClone })
  }
  // Counts per status for the toolbar's status dropdown. Each is one
  // `limit: 1` request read for its `pagination.total` — the server's count,
  // not the twenty-five rows that happen to be on screen.
  const stats = useCatalogStats('features')

  const failure = toFailure(features.error)
  const rows = features.data?.features ?? []
  const isFiltered =
    query.search.length > 0 || query.types.length > 0 || query.statuses.length > 0
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
            onEdit={(feature) => setEditing({ mode: 'edit', feature })}
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

      {editing?.mode === 'edit' ? (
        <FeatureEditorDialog
          open
          onOpenChange={(open) => {
            if (!open) closeEditor()
          }}
          mode="edit"
          feature={editing.feature}
          onSubmit={submitEdit(editing.feature)}
          groups={groupOptions}
          isSubmitting={active.isPending}
          submitError={toSubmitError(active.error)}
        />
      ) : (
        <FeatureEditorDialog
          open={editing?.mode === 'create'}
          onOpenChange={(open) => {
            if (!open) closeEditor()
          }}
          mode="create"
          onSubmit={submitCreate}
          groups={groupOptions}
          isSubmitting={create.isPending}
          submitError={toSubmitError(create.error, 'create')}
        />
      )}

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
